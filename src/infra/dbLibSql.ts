import { createClient, type Client } from '@libsql/client'
import { getLogger } from '@logtape/logtape'
import type { UserComponent } from '../agent/components'
import { FailedToPersistUserError } from '../errors'
import type { DB, FileSearchResult, RecentMessage, SimilarMessage } from './db'

const logger = getLogger(['app', 'infra', 'db'])

export namespace LibSql {
  export const db = (client?: Client): DB => {
    client =
      client ??
      createClient({
        url: 'file:./storage/db.db',
      })
    return {
      async storeWebhookEvent(payload) {
        await client.execute({
          sql: `INSERT INTO
          raw_incoming_message (payload)
          VALUES (?)`,
          args: [payload],
        })
      },
      async persistUser({ externalId, name }) {
        const insertResult = await client
          .execute({
            sql: `INSERT INTO
            user (id, external_id, name)
            VALUES(?, ?, ?)
            ON CONFLICT(external_id) DO UPDATE SET name = excluded.name
            RETURNING id, external_id, name, joined_at`,
            args: [Bun.randomUUIDv7(), externalId, name],
          })
          .catch((error) => {
            throw new FailedToPersistUserError(error.message)
          })

        if (insertResult.rows.length === 0) {
          console.log('Failed to persist user: no result')
          throw new FailedToPersistUserError('No user persisted')
        }

        const newUser = insertResult.rows[0]!

        const profileResult = await client.execute({
          sql: `SELECT upv.profile FROM user u
          LEFT JOIN user_profile_version upv ON u.id = upv.user_id
          WHERE u.id = ? 
          ORDER BY upv.id DESC 
          LIMIT 1`,
          args: [newUser.id as string],
        })

        const profile = (profileResult.rows[0]?.profile as string) || ''

        return {
          id: newUser.id as UserComponent['id'],
          externalId: newUser.external_id as UserComponent['externalId'],
          name: newUser.name as UserComponent['name'],
          joinedAt: new Date(newUser.joined_at as string),
          profile,
        }
      },
      async storeMessage(messages) {
        if (messages.length === 0) return []
        logger.debug('Storing messages', {
          messages: JSON.stringify(
            messages.map((m) => ({
              ...m,
              content: m.content.map((c) => ({
                ...c,
                embedding: '...',
              })),
            }))
          ),
        })

        const messageIds: string[] = []
        const statements = messages.flatMap((messageData) => {
          const id = Bun.randomUUIDv7()
          messageIds.push(id)
          return [
            {
              sql: `INSERT INTO
              message (id, external_id, user_id, role, type, media_storage_key)
              VALUES (?, ?, ?, ?, ?, ?)`,
              args: [
                id,
                messageData.externalId ?? null,
                messageData.userId,
                messageData.role,
                messageData.type,
                messageData.storageKey ?? null,
              ],
            },
            ...messageData.content.map((chunk, sequence) => ({
              sql: `INSERT INTO
              embedding (message_id, sequence, content, embedding)
              VALUES (?, ?, ?, vector32(?))`,
              args: [id, sequence + 1, chunk.content, JSON.stringify(chunk.embedding)],
            })),
          ]
        })

        await client.batch(statements)
        return messageIds
      },
      async findRecentMessages({ userId }) {
        const MAX_RECENT_MESSAGES = parseInt(import.meta.env.MAX_RECENT_MESSAGES ?? '100')
        const selectResult = await client.execute({
          sql: `SELECT m.id, m.role, GROUP_CONCAT(e.content, ' ') as content
          FROM message m
          JOIN embedding e ON m.id = e.message_id
          WHERE m.user_id = ?
          GROUP BY m.id
          ORDER BY m.timestamp DESC
          LIMIT ?`,
          args: [userId, MAX_RECENT_MESSAGES],
        })

        return selectResult.rows
          .map((row) => ({
            id: row.id as RecentMessage['id'],
            role: row.role as RecentMessage['role'],
            content: row.content as RecentMessage['content'],
          }))
          .reverse()
      },
      async findSimilarMessages({ userId, queryEmbedding, excludeIds = [] }) {
        const SIMILARITY_THRESHOLD = parseFloat(import.meta.env.SIMILARITY_THRESHOLD ?? '0.5')
        const MAX_SIMILAR_MESSAGES = parseInt(import.meta.env.MAX_SIMILAR_MESSAGES ?? '10')
        const queryEmbeddingString = JSON.stringify(queryEmbedding)

        const excludeClause = excludeIds.length
          ? ` AND m.id NOT IN (${excludeIds.map(() => '?').join(',')}) `
          : ''

        const result = await client.execute({
          sql: `
            SELECT m.id, m.role, e.content, m.type, m.timestamp
            FROM message m
            JOIN embedding e ON m.id = e.message_id
            WHERE m.user_id = ?
            ${excludeClause}
            AND vector_distance_cos(e.embedding, vector32(?)) < ?
            ORDER BY vector_distance_cos(e.embedding, vector32(?)) ASC
            LIMIT ?`,
          args: [
            userId,
            ...excludeIds,
            queryEmbeddingString,
            SIMILARITY_THRESHOLD,
            queryEmbeddingString,
            MAX_SIMILAR_MESSAGES,
          ],
        })

        return result.rows.map((row) => ({
          id: row.id as SimilarMessage['id'],
          role: row.role as SimilarMessage['role'],
          content: row.content as SimilarMessage['content'],
          type: row.type as SimilarMessage['type'],
          timestamp: new Date(row.timestamp as string),
        }))
      },
      async updateUserProfile({ userId, profile, messageId }) {
        await client.execute({
          sql: `INSERT INTO user_profile_version (id, user_id, profile, message_id)
          VALUES (?, ?, ?, ?)`,
          args: [Bun.randomUUIDv7(), userId, profile, messageId ?? null],
        })
      },

      async searchFiles({ userId, queryEmbedding }) {
        const SIMILARITY_THRESHOLD = parseFloat(import.meta.env.FILE_SIMILARITY_THRESHOLD ?? '0.50')
        const MAX_FILES = 10
        const queryEmbeddingString = JSON.stringify(queryEmbedding)

        const result = await client.execute({
          sql: `
            SELECT 
              m.id as message_id,
              m.media_storage_key as storage_key,
              m.timestamp,
              e.content,
              vector_distance_cos(e.embedding, vector32(?)) as distance
            FROM message m
            JOIN embedding e ON m.id = e.message_id
            WHERE m.user_id = ? 
            AND m.media_storage_key IS NOT NULL
            AND distance < ?
            ORDER BY distance ASC
            LIMIT 50`,
          args: [queryEmbeddingString, userId, SIMILARITY_THRESHOLD],
        })

        const fileGroups = new Map<
          string,
          {
            messageId: string
            storageKey: string
            timestamp: Date
            chunks: Array<{ content: string; distance: number }>
          }
        >()

        result.rows.forEach((row) => {
          const messageId = row.message_id as string

          if (!fileGroups.has(messageId)) {
            fileGroups.set(messageId, {
              storageKey: row.storage_key as string,
              messageId: row.message_id as string,
              timestamp: new Date(row.timestamp as string),
              chunks: [],
            })
          }

          fileGroups.get(messageId)!.chunks.push({
            content: row.content as string,
            distance: row.distance as number,
          })
        })

        // Calculate average scores and prepare results
        const fileResults: FileSearchResult[] = Array.from(fileGroups.values())
          .map((group) => {
            const score =
              1 - group.chunks.reduce((sum, chunk) => sum + chunk.distance, 0) / group.chunks.length
            const rawSnippet = group.chunks
              .sort((a, b) => a.distance - b.distance)
              .slice(0, 3)
              .map((chunk) => chunk.content)
              .join('\n\n')

            const snippet = sanitizeSnippet(rawSnippet)

            return {
              messageId: group.messageId,
              storageKey: group.storageKey,
              timestamp: group.timestamp,
              score,
              snippet,
            }
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_FILES)

        return fileResults
      },
    }
  }

  function sanitizeSnippet(text: string): string {
    // Redact email addresses
    text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')

    // Redact potential credit card numbers (simple regex for common patterns)
    text = text.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD]')
    text = text.replace(/\b\d{13,19}\b/g, '[CARD]')

    return text
  }
}
