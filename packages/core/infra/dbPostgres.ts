import { and, asc, eq, inArray, lte, or } from 'drizzle-orm'
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql'
import { FailedToPersistUserError } from '../errors'
import type { DB } from './db'
import { PostgresSchema } from './dbPostgresSchema'

const MAX_RECENT_MESSAGES = parseInt(import.meta.env.MAX_RECENT_MESSAGES ?? '10')
const VECTOR_DISTANCE_THRESHOLD = parseFloat(import.meta.env.VECTOR_DISTANCE_THRESHOLD ?? '0.50')
const MAX_SIMILAR_MESSAGES = parseInt(import.meta.env.MAX_SIMILAR_MESSAGES ?? '10')
const MAX_FILES = parseInt(import.meta.env.FILE_SEARCH_LIMIT ?? '10')
const SENDING_STALE_SECONDS = parseInt(import.meta.env.REMINDER_SENDING_STALE_SECONDS ?? '300')

type CoreSchema = Omit<typeof PostgresSchema, 'uuidv7'>

export namespace Postgres {
  export const dbFactory = <TSchema extends CoreSchema = CoreSchema>({
    client,
  }: {
    client: BunSQLDatabase<TSchema>
  }): DB.Repository => {
    return {
      async storeRawIncomingMessage(payload) {
        try {
          await client.insert(PostgresSchema.rawIncomingMessage).values({
            payload,
          })
          return true
        } catch (error) {
          // Handle PostgreSQL unique constraint violation (code 23505)
          // Check both the error itself and any nested cause
          const err = error as { code?: string; cause?: { code?: string } }
          if (err.code === '23505' || err.cause?.code === '23505') {
            return false
          }
          if (error instanceof Error && error.message?.includes('duplicate key')) {
            return false
          }
          throw error
        }
      },

      async persistUser(user) {
        const newUser = await client
          .insert(PostgresSchema.user)
          .values(user)
          .onConflictDoUpdate({
            target: PostgresSchema.user.waId,
            set: { name: user.name },
          })
          .returning()
          .then((result) => result[0])
          .catch((error) => {
            throw new FailedToPersistUserError((error as Error).message)
          })

        if (!newUser) {
          throw new FailedToPersistUserError('No user persisted')
        }

        return newUser
      },

      async storeMessage(messages) {
        const messageArray = Array.isArray(messages) ? messages : [messages]

        if (messageArray.length === 0) return []

        const messageIds = await client
          .insert(PostgresSchema.message)
          .values(messageArray)
          .returning({ id: PostgresSchema.message.id })
          .then((result) => result.map((r) => r.id))

        console.debug('Stored messages', JSON.stringify(messageArray, null, 2))

        return messageIds
      },

      async findRecentMessages({ userId }) {
        return await client
          .select()
          .from(PostgresSchema.message)
          .where(eq(PostgresSchema.message.userId, userId))
          .orderBy(asc(PostgresSchema.message.timestamp))
          .limit(MAX_RECENT_MESSAGES)
      },

      async findSimilarSnippets({ userId, queryEmbedding, excludeIds = [] }) {
        // const distance = cosineDistance(PostgresSchema.snippet.vector, queryEmbedding)

        // const conditions = [
        //   eq(PostgresSchema.message.userId, userId),
        //   lt(distance, VECTOR_DISTANCE_THRESHOLD),
        // ]

        // if (excludeIds.length > 0) {
        //   conditions.push(notInArray(PostgresSchema.message.id, excludeIds))
        // }

        // const results = await client
        //   .select({
        //     id: PostgresSchema.message.id,
        //     content: PostgresSchema.snippet.content,
        //     type: PostgresSchema.message.type,
        //     timestamp: PostgresSchema.message.timestamp,
        //     chunkSequence: PostgresSchema.snippet.sequence,
        //     totalChunks: sql<number>`(SELECT COUNT(*) FROM ${PostgresSchema.snippet} e2 WHERE e2.message_id = ${PostgresSchema.message.id})`,
        //     modelMessage: PostgresSchema.message.modelMessage,
        //     resourceId: PostgresSchema.message.resourceId,
        //   })
        //   .from(PostgresSchema.message)
        //   .innerJoin(
        //     PostgresSchema.snippet,
        //     eq(PostgresSchema.message.id, PostgresSchema.snippet.messageId)
        //   )
        //   .where(and(...conditions))
        //   .orderBy(distance)
        //   .limit(MAX_SIMILAR_MESSAGES)

        // return results.map((row) => ({
        //   id: row.id,
        //   content: row.content,
        //   type: row.type as DB.MessageType,
        //   timestamp: row.timestamp,
        //   chunkSequence: row.chunkSequence,
        //   totalChunks: row.totalChunks,
        //   modelMessage: row.modelMessage ?? undefined,
        //   resourceId: row.resourceId ?? undefined,
        // })) as any
        return []
      },

      async createResource(params) {
        const insertResult = await client
          .insert(PostgresSchema.resource)
          .values({
            userId: params.userId,
            storageKey: params.storageKey,
            size: params.size ?? null,
            mimeType: params.mimeType ?? null,
            hash: params.hash ?? null,
            originalFilename: params.originalFilename ?? null,
          })
          .returning()

        return insertResult[0]!
      },

      async findResource({ userId, resourceId }) {
        const result = await client
          .select()
          .from(PostgresSchema.resource)
          .where(
            and(
              eq(PostgresSchema.resource.userId, userId),
              eq(PostgresSchema.resource.id, resourceId)
            )
          )
          .limit(1)

        return result[0] ?? null
      },

      async searchFiles({ userId, queryEmbedding }) {
        // No-op implementation - returns empty results
        // Original implementation (pseudocode):
        // 1. Calculate cosine distance between queryEmbedding and snippet.vector
        // 2. Query messages+snippets WHERE userId matches, resourceId IS NOT NULL, distance < threshold
        // 3. Group results by messageId into fileGroups Map:
        //    - Each group contains: messageId, resourceId, timestamp, chunks[]
        //    - Each chunk contains: content, distance
        // 4. For each fileGroup:
        //    - Calculate score = 1 - (avg distance across chunks)
        //    - Build rawSnippet from top 3 chunks (sorted by distance asc), joined by '\n\n'
        //    - Sanitize snippet (redact emails, credit cards)
        //    - Return { messageId, resourceId, timestamp, score, snippet }
        // 5. Sort by score desc, limit to MAX_FILES
        return []
      },

      async createReminder(params) {
        const insertResult = await client
          .insert(PostgresSchema.reminder)
          .values({
            userId: params.userId,
            status: 'scheduled',
            dueAt: params.dueAt,
            description: params.description,
            message: params.message,
            recurrenceCron: params.recurrenceCron ?? null,
          })
          .returning()

        return insertResult[0]!
      },

      async cancelReminder({ id }) {
        const result = await client
          .update(PostgresSchema.reminder)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(
            and(
              eq(PostgresSchema.reminder.id, id),
              inArray(PostgresSchema.reminder.status, ['scheduled', 'sending'])
            )
          )
          .returning({ id: PostgresSchema.reminder.id })

        return result.length > 0
      },

      async listUpcomingReminders({ userId, limit = 10 }) {
        const results = await client
          .select()
          .from(PostgresSchema.reminder)
          .where(
            and(
              eq(PostgresSchema.reminder.userId, userId),
              eq(PostgresSchema.reminder.status, 'scheduled')
            )
          )
          .orderBy(PostgresSchema.reminder.dueAt)
          .limit(limit)

        return results
      },

      async takeDueReminders({ now, limit = 100 }) {
        const staleBefore = new Date(now.getTime() - SENDING_STALE_SECONDS * 1000)

        return await client.transaction(async (tx) => {
          const candidates = await tx
            .select({
              id: PostgresSchema.reminder.id,
              userId: PostgresSchema.reminder.userId,
              message: PostgresSchema.reminder.message,
              prevStatus: PostgresSchema.reminder.status,
            })
            .from(PostgresSchema.reminder)
            .where(
              or(
                and(
                  eq(PostgresSchema.reminder.status, 'scheduled'),
                  lte(PostgresSchema.reminder.dueAt, now)
                ),
                and(
                  eq(PostgresSchema.reminder.status, 'sending'),
                  lte(PostgresSchema.reminder.updatedAt, staleBefore)
                )
              )
            )
            .orderBy(PostgresSchema.reminder.dueAt)
            .limit(limit)
            .for('update')

          if (candidates.length === 0) {
            return []
          }

          const candidateIds = candidates.map((c) => c.id)
          await tx
            .update(PostgresSchema.reminder)
            .set({ status: 'sending', updatedAt: new Date() })
            .where(inArray(PostgresSchema.reminder.id, candidateIds))

          const updatedReminders = await tx
            .select()
            .from(PostgresSchema.reminder)
            .where(inArray(PostgresSchema.reminder.id, candidateIds))

          return updatedReminders
        })
      },

      async markReminderSent({ id, waMessageId }) {
        await client
          .update(PostgresSchema.reminder)
          .set({
            status: 'sent',
            sentAt: new Date(),
            waMessageId,
            updatedAt: new Date(),
          })
          .where(eq(PostgresSchema.reminder.id, id))
      },

      async markReminderFailed({ id, error }) {
        await client
          .update(PostgresSchema.reminder)
          .set({
            status: 'failed',
            error,
            updatedAt: new Date(),
          })
          .where(eq(PostgresSchema.reminder.id, id))
      },

      async deleteMessages({ userId }) {
        await client.delete(PostgresSchema.message).where(eq(PostgresSchema.message.userId, userId))
      },
    }
  }
}
