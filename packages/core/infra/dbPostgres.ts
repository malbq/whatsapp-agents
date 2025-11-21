import { and, asc, eq, inArray, lte, or } from 'drizzle-orm'
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql'
import { FailedToPersistUserError } from '../errors'
import type { DB } from './db'
import { PostgresSchema as Schema } from './dbPostgresSchema'

const MAX_RECENT_MESSAGES = parseInt(import.meta.env.MAX_RECENT_MESSAGES ?? '30')
const VECTOR_DISTANCE_THRESHOLD = parseFloat(import.meta.env.VECTOR_DISTANCE_THRESHOLD ?? '0.50')
const MAX_SIMILAR_MESSAGES = parseInt(import.meta.env.MAX_SIMILAR_MESSAGES ?? '10')
const MAX_FILES = parseInt(import.meta.env.FILE_SEARCH_LIMIT ?? '10')
const SENDING_STALE_SECONDS = parseInt(import.meta.env.REMINDER_SENDING_STALE_SECONDS ?? '300')

type CoreSchema = Omit<typeof Schema, 'uuidv7'>

export namespace Postgres {
  export const dbFactory = <TSchema extends CoreSchema = CoreSchema>({
    client,
  }: {
    client: BunSQLDatabase<TSchema>
  }): DB.Repository => {
    return {
      async storeRawIncomingMessage(payload) {
        try {
          await client.insert(Schema.rawIncomingMessage).values({
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
          .insert(Schema.user)
          .values(user)
          .onConflictDoUpdate({
            target: Schema.user.waId,
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
          .insert(Schema.message)
          .values(messageArray)
          .returning({ id: Schema.message.id })
          .then((result) => result.map((r) => r.id))

        console.debug('Stored messages')
        console.dir(messageArray, { depth: null })

        return messageIds
      },

      async findRecentMessages({ userId }) {
        return await client
          .select({
            id: Schema.message.id,
            userId: Schema.message.userId,
            waId: Schema.message.waId,
            type: Schema.message.type,
            modelMessage: Schema.message.modelMessage,
            usageInputTokens: Schema.message.usageInputTokens,
            usageOutputTokens: Schema.message.usageOutputTokens,
            usageTotalTokens: Schema.message.usageTotalTokens,
            usageCachedInputTokens: Schema.message.usageCachedInputTokens,
            usageReasoningTokens: Schema.message.usageReasoningTokens,
            resourceId: Schema.message.resourceId,
            timestamp: Schema.message.timestamp,
            storageKey: Schema.resource.storageKey,
          })
          .from(Schema.message)
          .leftJoin(Schema.resource, eq(Schema.message.resourceId, Schema.resource.id))
          .where(eq(Schema.message.userId, userId))
          .orderBy(asc(Schema.message.timestamp))
          .limit(MAX_RECENT_MESSAGES)
      },

      async findSimilarSnippets({ userId, queryEmbedding, excludeIds = [] }) {
        // const distance = cosineDistance(Schema.snippet.vector, queryEmbedding)

        // const conditions = [
        //   eq(Schema.message.userId, userId),
        //   lt(distance, VECTOR_DISTANCE_THRESHOLD),
        // ]

        // if (excludeIds.length > 0) {
        //   conditions.push(notInArray(Schema.message.id, excludeIds))
        // }

        // const results = await client
        //   .select({
        //     id: Schema.message.id,
        //     content: Schema.snippet.content,
        //     type: Schema.message.type,
        //     timestamp: Schema.message.timestamp,
        //     chunkSequence: Schema.snippet.sequence,
        //     totalChunks: sql<number>`(SELECT COUNT(*) FROM ${Schema.snippet} e2 WHERE e2.message_id = ${Schema.message.id})`,
        //     modelMessage: Schema.message.modelMessage,
        //     resourceId: Schema.message.resourceId,
        //   })
        //   .from(Schema.message)
        //   .innerJoin(
        //     Schema.snippet,
        //     eq(Schema.message.id, Schema.snippet.messageId)
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
          .insert(Schema.resource)
          .values({
            userId: params.userId,
            storageKey: params.storageKey,
            size: params.size ?? null,
            mimeType: params.mimeType ?? null,
            hash: params.hash,
            originalFilename: params.originalFilename ?? null,
          })
          .onConflictDoNothing({
            target: Schema.resource.hash,
          })
          .returning()

        if (insertResult[0]) {
          return insertResult[0]
        }

        const existing = await client
          .select()
          .from(Schema.resource)
          .where(eq(Schema.resource.hash, params.hash))
          .limit(1)

        return existing[0]!
      },

      async findResource({ userId, resourceId }) {
        const result = await client
          .select()
          .from(Schema.resource)
          .where(and(eq(Schema.resource.userId, userId), eq(Schema.resource.id, resourceId)))
          .limit(1)

        return result[0] ?? null
      },

      async findResourceIdByHash({ userId, hash }) {
        const result = await client
          .select()
          .from(Schema.resource)
          .where(and(eq(Schema.resource.userId, userId), eq(Schema.resource.hash, hash)))
          .limit(1)

        return result[0]?.id
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
          .insert(Schema.reminder)
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
          .update(Schema.reminder)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(
            and(
              eq(Schema.reminder.id, id),
              inArray(Schema.reminder.status, ['scheduled', 'sending'])
            )
          )
          .returning({ id: Schema.reminder.id })

        return result.length > 0
      },

      async listUpcomingReminders({ userId, limit = 10 }) {
        const results = await client
          .select()
          .from(Schema.reminder)
          .where(and(eq(Schema.reminder.userId, userId), eq(Schema.reminder.status, 'scheduled')))
          .orderBy(Schema.reminder.dueAt)
          .limit(limit)

        return results
      },

      async takeDueReminders({ now, limit = 100 }) {
        const staleBefore = new Date(now.getTime() - SENDING_STALE_SECONDS * 1000)

        return await client.transaction(async (tx) => {
          const candidates = await tx
            .select({
              id: Schema.reminder.id,
              userId: Schema.reminder.userId,
              message: Schema.reminder.message,
              prevStatus: Schema.reminder.status,
            })
            .from(Schema.reminder)
            .where(
              or(
                and(eq(Schema.reminder.status, 'scheduled'), lte(Schema.reminder.dueAt, now)),
                and(
                  eq(Schema.reminder.status, 'sending'),
                  lte(Schema.reminder.updatedAt, staleBefore)
                )
              )
            )
            .orderBy(Schema.reminder.dueAt)
            .limit(limit)
            .for('update')

          if (candidates.length === 0) {
            return []
          }

          const candidateIds = candidates.map((c) => c.id)
          await tx
            .update(Schema.reminder)
            .set({ status: 'sending', updatedAt: new Date() })
            .where(inArray(Schema.reminder.id, candidateIds))

          const updatedReminders = await tx
            .select()
            .from(Schema.reminder)
            .where(inArray(Schema.reminder.id, candidateIds))

          return updatedReminders
        })
      },

      async markReminderSent({ id, waMessageId }) {
        await client
          .update(Schema.reminder)
          .set({
            status: 'sent',
            sentAt: new Date(),
            waMessageId,
            updatedAt: new Date(),
          })
          .where(eq(Schema.reminder.id, id))
      },

      async markReminderFailed({ id, error }) {
        await client
          .update(Schema.reminder)
          .set({
            status: 'failed',
            error,
            updatedAt: new Date(),
          })
          .where(eq(Schema.reminder.id, id))
      },

      async deleteMessages({ userId }) {
        await client.delete(Schema.message).where(eq(Schema.message.userId, userId))
      },
    }
  }
}
