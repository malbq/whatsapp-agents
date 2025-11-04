import { createClient, type Client } from '@libsql/client'
import { FailedToPersistUserError } from '../errors'
import type { DB, RecentMessage, SimilarMessage, User } from './db'

const MAX_RECENT_MESSAGES = parseInt(import.meta.env.MAX_RECENT_MESSAGES ?? '100')
const VECTOR_DISTANCE_THRESHOLD = parseFloat(import.meta.env.VECTOR_DISTANCE_THRESHOLD ?? '0.50')
const MAX_SIMILAR_MESSAGES = parseInt(import.meta.env.MAX_SIMILAR_MESSAGES ?? '10')

export namespace LibSql {
  export const db = ({ client, url }: { client?: Client; url?: string }): DB => {
    url ??= 'file:./storage/assistant.db'
    client ??= createClient({ url })
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
          throw new FailedToPersistUserError('No user persisted')
        }

        const newUser = insertResult.rows[0]!

        return {
          id: newUser.id as User['id'],
          externalId: newUser.external_id as User['externalId'],
          name: newUser.name as User['name'],
          joinedAt: new Date(newUser.joined_at as string),
        }
      },
      async storeMessage(messages) {
        if (messages.length === 0) return []

        const messageIds: string[] = []
        const statements = messages.flatMap((message) => {
          const id = Bun.randomUUIDv7()
          messageIds.push(id)
          return [
            {
              sql: `INSERT INTO
              message (id, external_id, user_id, role, type)
              VALUES (?, ?, ?, ?, ?)`,
              args: [id, message.externalId ?? null, message.userId, message.role, message.type],
            },
            ...message.content.map((chunk, sequence) => ({
              sql: `INSERT INTO
              embedding (message_id, sequence, content, embedding)
              VALUES (?, ?, ?, vector32(?))`,
              args: [id, sequence + 1, chunk.content, JSON.stringify(chunk.embedding)],
            })),
          ]
        })

        await client.batch(statements)

        console.debug('Stored messages', {
          messages: messages.map((m) => ({
            ...m,
            content: m.content.map((c) => ({
              ...c,
              embedding: '...',
            })),
          })),
        })

        return messageIds
      },

      async findRecentMessages({ userId }) {
        const selectResult = await client.execute({
          sql: `SELECT m.id, m.role, m.type,
          CASE
            WHEN m.type IN ('document') THEN SUBSTR(GROUP_CONCAT(e.content, ' '), 1, 200)
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
            type: row.type as RecentMessage['type'],
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
    }
  }
}
