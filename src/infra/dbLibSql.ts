import { createClient, type Client } from '@libsql/client'
import { getLogger } from '@logtape/logtape'
import { FailedToPersistUserError } from '../errors'
import type { DB, FileSearchResult, RecentMessage, SimilarMessage, User } from './db'

const MAX_RECENT_MESSAGES = parseInt(import.meta.env.MAX_RECENT_MESSAGES ?? '100')
const VECTOR_DISTANCE_THRESHOLD = parseFloat(
  import.meta.env.FILE_VECTOR_DISTANCE_THRESHOLD ?? '0.50'
)
const MAX_SIMILAR_MESSAGES = parseInt(import.meta.env.MAX_SIMILAR_MESSAGES ?? '10')
const MAX_FILES = parseInt(import.meta.env.FILE_SEARCH_LIMIT ?? '10')
const SENDING_STALE_SECONDS = parseInt(import.meta.env.REMINDER_SENDING_STALE_SECONDS ?? '300')

const logger = getLogger(['infra', 'db'])

export namespace LibSql {
  export const db = (client?: Client): DB => {
    client ??= createClient({
      url: 'file:./storage/assistant.db',
    })
    return {
      async storeWebhookEvent(payload, externalId) {
        try {
          await client.execute({
            sql: `INSERT INTO
            raw_incoming_message (external_id, payload)
            VALUES (?, ?)`,
            args: [externalId, payload],
          })
          return true
        } catch (error) {
          if (error instanceof Error && error.message?.includes('UNIQUE constraint failed')) {
            return false
          }
          throw error
        }
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
          sql: `SELECT p.profile FROM user u
          LEFT JOIN user_profile_version p ON u.id = p.user_id
          WHERE u.id = ? 
          ORDER BY p.id DESC 
          LIMIT 1`,
          args: [newUser.id as string],
        })

        const profile = (profileResult.rows[0]?.profile as string) || ''

        return {
          id: newUser.id as User['id'],
          externalId: newUser.external_id as User['externalId'],
          name: newUser.name as User['name'],
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
        const selectResult = await client.execute({
          sql: `SELECT m.id, m.role, m.type,
          CASE 
            WHEN m.type IN ('document', 'image') THEN SUBSTR(GROUP_CONCAT(e.content, ' '), 1, 200)
            ELSE GROUP_CONCAT(e.content, ' ')
          END as content
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
          .toReversed()
      },

      async findSimilarMessages({ userId, queryEmbedding, excludeIds = [] }) {
        const queryEmbeddingString = JSON.stringify(queryEmbedding)

        const excludeClause = excludeIds.length
          ? ` AND m.id NOT IN (${excludeIds.map(() => '?').join(',')}) `
          : ''

        const result = await client.execute({
          sql: `
            SELECT 
              m.id, 
              m.role, 
              e.content, 
              m.type, 
              m.timestamp,
              e.sequence as chunk_sequence,
              (SELECT COUNT(*) FROM embedding e2 WHERE e2.message_id = m.id) as total_chunks
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
            VECTOR_DISTANCE_THRESHOLD,
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
          chunkSequence: row.chunk_sequence as number,
          totalChunks: row.total_chunks as number,
        }))
      },

      async updateUserProfile({ userId, profile }) {
        profile = profile.trim()
        if (profile.length === 0) return
        await client.execute({
          sql: `INSERT INTO user_profile_version (id, user_id, profile)
          VALUES (?, ?, ?)`,
          args: [Bun.randomUUIDv7(), userId, profile],
        })
      },

      async searchFiles({ userId, queryEmbedding }) {
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
          args: [queryEmbeddingString, userId, VECTOR_DISTANCE_THRESHOLD],
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

      async createReminder(params) {
        const id = Bun.randomUUIDv7()
        await client.execute({
          sql: `INSERT INTO reminder (
            id, user_id, status, due_at, description, message, recurrence_cron
          ) VALUES (?, ?, 'scheduled', ?, ?, ?, ?)`,
          args: [
            id,
            params.userId,
            params.dueAt.toISOString(),
            params.description,
            params.message,
            params.recurrenceCron ?? null,
          ],
        })
        return { id }
      },

      async cancelReminder({ id }) {
        const result = await client.execute({
          sql: `UPDATE reminder SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND status IN ('scheduled', 'sending')
                RETURNING id`,
          args: [id],
        })
        return result.rows.length > 0
      },

      async listUpcomingReminders({ userId, limit = 10 }) {
        const result = await client.execute({
          sql: `SELECT id, due_at, description, message
                FROM reminder
                WHERE user_id = ? AND status = 'scheduled'
                ORDER BY due_at ASC
                LIMIT ?`,
          args: [userId, limit],
        })
        return result.rows.map((row) => ({
          id: row.id as string,
          dueAt: new Date(row.due_at as string),
          description: row.description as string,
          message: row.message as string,
        }))
      },

      async takeDueReminders({ now, limit = 100 }) {
        const staleBefore = new Date(now.getTime() - SENDING_STALE_SECONDS * 1000)
        await client.execute('BEGIN IMMEDIATE')
        try {
          const candidatesResult = await client.execute({
            sql: `SELECT id, user_id, message, status AS prev_status
                  FROM reminder
                  WHERE (
                    status = 'scheduled' AND due_at <= ?
                  ) OR (
                    status = 'sending' AND updated_at <= ?
                  )
                  ORDER BY due_at ASC
                  LIMIT ?`,
            args: [now.toISOString(), staleBefore.toISOString(), limit],
          })

          const candidates = candidatesResult.rows.map((row) => ({
            id: row.id as string,
            userId: row.user_id as string,
            message: row.message as string,
            isReclaimed: row.prev_status === 'sending',
          }))

          if (candidates.length === 0) {
            await client.execute('COMMIT')
            return []
          }

          const placeholders = candidates.map(() => '?').join(',')
          await client.execute({
            sql: `UPDATE reminder
                  SET status = 'sending', updated_at = CURRENT_TIMESTAMP
                  WHERE id IN (${placeholders})`,
            args: candidates.map((c) => c.id),
          })

          await client.execute('COMMIT')
          return candidates
        } catch (error) {
          await client.execute('ROLLBACK')
          throw error
        }
      },

      async markReminderSent({ id, waMessageId }) {
        await client.execute({
          sql: `UPDATE reminder SET status = 'sent', sent_at = CURRENT_TIMESTAMP,
                wa_message_id = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
          args: [waMessageId, id],
        })
      },

      async markReminderFailed({ id, error }) {
        await client.execute({
          sql: `UPDATE reminder SET status = 'failed', error = ?,
                updated_at = CURRENT_TIMESTAMP
                WHERE id = ?`,
          args: [error, id],
        })
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
