import { and, cosineDistance, desc, eq, inArray, lt, lte, notInArray, or, sql } from 'drizzle-orm'
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { FailedToPersistUserError } from '../errors'
import type { DB } from './db'
import { PostgresSchema } from './dbPostgresSchema'

const MAX_RECENT_MESSAGES = parseInt(import.meta.env.MAX_RECENT_MESSAGES ?? '10')
const VECTOR_DISTANCE_THRESHOLD = parseFloat(import.meta.env.VECTOR_DISTANCE_THRESHOLD ?? '0.50')
const MAX_SIMILAR_MESSAGES = parseInt(import.meta.env.MAX_SIMILAR_MESSAGES ?? '10')
const MAX_FILES = parseInt(import.meta.env.FILE_SEARCH_LIMIT ?? '10')
const SENDING_STALE_SECONDS = parseInt(import.meta.env.REMINDER_SENDING_STALE_SECONDS ?? '300')

export namespace Postgres {
  export const dbFactory = ({
    client,
    url,
  }: {
    client?: PostgresJsDatabase<typeof PostgresSchema>
    url?: string
  }): DB.Repository => {
    if (!client && !url) {
      throw new Error('Either client or url must be provided')
    }
    if (url && !client) {
      client = drizzle(postgres(url), { schema: PostgresSchema })
    }
    if (!client) {
      throw new Error('Client is required')
    }

    return {
      client,
      async storeRawIncomingMessage(payload, waId) {
        try {
          await client.insert(PostgresSchema.rawIncomingMessage).values({
            waId,
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

      async persistUser({ waId, name }) {
        try {
          const insertResult = await client
            .insert(PostgresSchema.user)
            .values({
              waId,
              name,
            })
            .onConflictDoUpdate({
              target: PostgresSchema.user.waId,
              set: { name },
            })
            .returning()

          if (insertResult.length === 0) {
            throw new FailedToPersistUserError('No user persisted')
          }

          const newUser = insertResult[0]!

          return {
            id: newUser.id,
            waId: newUser.waId,
            name: newUser.name,
            joinedAt: newUser.joinedAt,
          }
        } catch (error) {
          if (error instanceof FailedToPersistUserError) throw error
          throw new FailedToPersistUserError((error as Error).message)
        }
      },

      async storeMessage(messages) {
        if (messages.length === 0) return []

        const messageIds: string[] = []
        const embeddings: Array<{
          messageId: string
          sequence: number
          content: string
          vector: Array<number>
        }> = []

        await client.transaction(async (tx) => {
          const insertedMessages = await tx
            .insert(PostgresSchema.message)
            .values(
              messages.map((msg: any) => ({
                userId: msg.userId,
                waId: msg.waId ?? null,
                type: msg.type,
                modelMessage: msg.modelMessage ?? ({} as any),
                usageInputTokens: msg.usageInputTokens ?? null,
                usageOutputTokens: msg.usageOutputTokens ?? null,
                usageTotalTokens: msg.usageTotalTokens ?? null,
                usageCachedInputTokens: msg.usageCachedInputTokens ?? null,
                usageReasoningTokens: msg.usageReasoningTokens ?? null,
                resourceId: msg.resourceId ?? null,
              }))
            )
            .returning({ id: PostgresSchema.message.id })

          insertedMessages.forEach((insertedMessage, index) => {
            const messageId = insertedMessage.id
            messageIds.push(messageId)

            const msg = messages[index] as any
            if (msg.content && Array.isArray(msg.content) && msg.content.length > 0) {
              msg.content.forEach((chunk: any, chunkIndex: number) => {
                embeddings.push({
                  messageId,
                  sequence: chunkIndex + 1,
                  content: chunk.content,
                  vector: chunk.embedding,
                })
              })
            }
          })

          if (embeddings.length > 0) {
            await tx.insert(PostgresSchema.snippet).values(embeddings)
          }
        })

        console.debug('Stored messages', {
          messages: messages.map((m: any) => ({
            ...m,
            modelMessage: m.modelMessage ? '...' : undefined,
            content: m.content?.map((c: any) => ({
              ...c,
              embedding: '...',
            })),
          })),
        })

        return messageIds
      },

      async findRecentMessages({ userId }) {
        const results = await client
          .select({
            id: PostgresSchema.message.id,
            type: PostgresSchema.message.type,
            modelMessage: PostgresSchema.message.modelMessage,
            resourceId: PostgresSchema.message.resourceId,
            content: sql<string>`
              CASE 
                WHEN ${PostgresSchema.message.type} IN ('document') 
                THEN SUBSTR(STRING_AGG(${PostgresSchema.snippet.content}, ' '), 1, 200)
                ELSE STRING_AGG(${PostgresSchema.snippet.content}, ' ')
              END
            `,
          })
          .from(PostgresSchema.message)
          .innerJoin(
            PostgresSchema.snippet,
            eq(PostgresSchema.message.id, PostgresSchema.snippet.messageId)
          )
          .where(eq(PostgresSchema.message.userId, userId))
          .groupBy(
            PostgresSchema.message.id,
            PostgresSchema.message.type,
            PostgresSchema.message.resourceId
          )
          .orderBy(desc(PostgresSchema.message.id))
          .limit(MAX_RECENT_MESSAGES)

        const mapped = results.map((row) => ({
          id: row.id,
          content: row.content,
          type: row.type as DB.MessageType,
          modelMessage: row.modelMessage ?? undefined,
          resourceId: row.resourceId ?? undefined,
        })) as any

        return mapped.toReversed()
      },

      async findSimilarSnippets({ userId, queryEmbedding, excludeIds = [] }) {
        const distance = cosineDistance(PostgresSchema.snippet.vector, queryEmbedding)

        const conditions = [
          eq(PostgresSchema.message.userId, userId),
          lt(distance, VECTOR_DISTANCE_THRESHOLD),
        ]

        if (excludeIds.length > 0) {
          conditions.push(notInArray(PostgresSchema.message.id, excludeIds))
        }

        const results = await client
          .select({
            id: PostgresSchema.message.id,
            content: PostgresSchema.snippet.content,
            type: PostgresSchema.message.type,
            timestamp: PostgresSchema.message.timestamp,
            chunkSequence: PostgresSchema.snippet.sequence,
            totalChunks: sql<number>`(SELECT COUNT(*) FROM ${PostgresSchema.snippet} e2 WHERE e2.message_id = ${PostgresSchema.message.id})`,
            modelMessage: PostgresSchema.message.modelMessage,
            resourceId: PostgresSchema.message.resourceId,
          })
          .from(PostgresSchema.message)
          .innerJoin(
            PostgresSchema.snippet,
            eq(PostgresSchema.message.id, PostgresSchema.snippet.messageId)
          )
          .where(and(...conditions))
          .orderBy(distance)
          .limit(MAX_SIMILAR_MESSAGES)

        return results.map((row) => ({
          id: row.id,
          content: row.content,
          type: row.type as DB.MessageType,
          timestamp: row.timestamp,
          chunkSequence: row.chunkSequence,
          totalChunks: row.totalChunks,
          modelMessage: row.modelMessage ?? undefined,
          resourceId: row.resourceId ?? undefined,
        })) as any
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
        const distance = cosineDistance(PostgresSchema.snippet.vector, queryEmbedding)

        const results = await client
          .select({
            messageId: PostgresSchema.message.id,
            resourceId: PostgresSchema.message.resourceId,
            timestamp: PostgresSchema.message.timestamp,
            content: PostgresSchema.snippet.content,
            distance: sql<number>`${distance}`,
          })
          .from(PostgresSchema.message)
          .innerJoin(
            PostgresSchema.snippet,
            eq(PostgresSchema.message.id, PostgresSchema.snippet.messageId)
          )
          .where(
            and(
              eq(PostgresSchema.message.userId, userId),
              sql`${PostgresSchema.message.resourceId} IS NOT NULL`,
              lt(distance, VECTOR_DISTANCE_THRESHOLD)
            )
          )
          .orderBy(distance)
          .limit(50)

        const fileGroups = new Map<
          string,
          {
            messageId: string
            resourceId: string
            timestamp: Date
            chunks: Array<{ content: string; distance: number }>
          }
        >()

        results.forEach((row) => {
          const messageId = row.messageId

          if (!fileGroups.has(messageId)) {
            fileGroups.set(messageId, {
              resourceId: row.resourceId!,
              messageId: row.messageId,
              timestamp: row.timestamp,
              chunks: [],
            })
          }

          fileGroups.get(messageId)!.chunks.push({
            content: row.content,
            distance: row.distance,
          })
        })

        const fileResults = Array.from(fileGroups.values())
          .map((group) => {
            const score =
              1 - group.chunks.reduce((sum, chunk) => sum + chunk.distance, 0) / group.chunks.length

            const rawSnippet = group.chunks
              .toSorted((a, b) => a.distance - b.distance)
              .slice(0, 3)
              .map((chunk) => chunk.content)
              .join('\n\n')

            const snippet = sanitizeSnippet(rawSnippet)

            return {
              messageId: group.messageId,
              resourceId: group.resourceId,
              timestamp: group.timestamp,
              score,
              snippet,
            }
          })
          .toSorted((a, b) => b.score - a.score)
          .slice(0, MAX_FILES)

        return fileResults
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

  function sanitizeSnippet(text: string): string {
    // Redact email addresses
    text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')

    // Redact potential credit card numbers (simple regex for common patterns)
    text = text.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD]')
    text = text.replace(/\b\d{13,19}\b/g, '[CARD]')

    return text
  }
}
