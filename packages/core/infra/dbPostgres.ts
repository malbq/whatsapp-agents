import { and, desc, eq, inArray, isNotNull, lte, notInArray, or, sql, type SQL } from 'drizzle-orm'
import type { BunSQLDatabase } from 'drizzle-orm/bun-sql'
import { inspect } from 'node:util'
import { FailedToPersistUserError } from '../errors'
import type { DB } from './db'
import { PostgresSchema as Schema } from './dbSchema'

type CoreSchema = Omit<typeof Schema, 'uuidv7'>

interface HybridSearchRow {
  snippetId: string
  messageId: string
  resourceId: string | null
  filename: string | null
  type: string
  role: string
  timestamp: Date
  content: string
  sequence: number
  distance: number
}

interface RankedSnippet extends HybridSearchRow {
  rrfScore: number
}

export namespace Postgres {
  export const dbFactory = <TSchema extends CoreSchema = CoreSchema>({
    client,
  }: {
    client: BunSQLDatabase<TSchema>
  }): DB.Repository => {
    /**
     * Performs hybrid search (vector + FTS) with RRF fusion.
     * Returns snippets ranked by combined score.
     */
    async function hybridSearch(params: {
      userId: string
      query: string
      queryEmbedding: Array<number>
      limit: number
      rrfK: number
      extraConditions?: Array<SQL>
      joinResource?: boolean
    }): Promise<Array<RankedSnippet>> {
      const { userId, query, queryEmbedding, limit, rrfK, extraConditions = [] } = params
      if (query.trim().length === 0) return []

      const vectorLiteral = `[${queryEmbedding.join(',')}]`
      const distanceSql = sql<number>`(${Schema.snippet.vector} <-> ${vectorLiteral}::vector)`

      const baseConditions = [eq(Schema.message.userId, userId), ...extraConditions]

      // Vector search
      const vectorQuery = client
        .select({
          snippetId: Schema.snippet.id,
          messageId: Schema.message.id,
          resourceId: Schema.message.resourceId,
          filename: params.joinResource ? Schema.resource.originalFilename : sql<null>`NULL`,
          type: Schema.message.type,
          role: Schema.message.role,
          timestamp: Schema.message.timestamp,
          content: Schema.snippet.content,
          sequence: Schema.snippet.sequence,
          distance: distanceSql,
        })
        .from(Schema.snippet)
        .innerJoin(Schema.message, eq(Schema.snippet.messageId, Schema.message.id))

      if (params.joinResource) {
        vectorQuery.innerJoin(Schema.resource, eq(Schema.message.resourceId, Schema.resource.id))
      }

      const vectorRows = await vectorQuery
        .where(and(...baseConditions))
        .orderBy(distanceSql)
        .limit(limit)

      // Text search
      const textConditions = [
        ...baseConditions,
        sql`snippet.fts @@ plainto_tsquery('simple', ${query})`,
      ]

      const textQuery = client
        .select({
          snippetId: Schema.snippet.id,
          messageId: Schema.message.id,
          resourceId: Schema.message.resourceId,
          filename: params.joinResource ? Schema.resource.originalFilename : sql<null>`NULL`,
          type: Schema.message.type,
          role: Schema.message.role,
          timestamp: Schema.message.timestamp,
          content: Schema.snippet.content,
          sequence: Schema.snippet.sequence,
          distance: sql<number>`0`, // FTS doesn't have distance
        })
        .from(Schema.snippet)
        .innerJoin(Schema.message, eq(Schema.snippet.messageId, Schema.message.id))

      if (params.joinResource) {
        textQuery.innerJoin(Schema.resource, eq(Schema.message.resourceId, Schema.resource.id))
      }

      const textRows = await textQuery
        .where(and(...textConditions))
        .orderBy(sql`ts_rank_cd(snippet.fts, plainto_tsquery('simple', ${query})) DESC`)
        .limit(limit)

      // RRF fusion
      const fusedBySnippetId = new Map<
        string,
        HybridSearchRow & { vectorRank?: number; textRank?: number }
      >()

      vectorRows.forEach((row, index) => {
        fusedBySnippetId.set(row.snippetId, { ...row, vectorRank: index + 1 })
      })

      textRows.forEach((row, index) => {
        const textRank = index + 1
        const existing = fusedBySnippetId.get(row.snippetId)
        if (existing) {
          existing.textRank = textRank
        } else {
          fusedBySnippetId.set(row.snippetId, { ...row, textRank })
        }
      })

      // Compute RRF scores and sort
      return fusedBySnippetId
        .values()
        .map((entry) => {
          let rrfScore = 0
          if (entry.vectorRank !== undefined) {
            rrfScore += 1 / (entry.vectorRank + rrfK)
          }
          if (entry.textRank !== undefined) {
            rrfScore += 1 / (entry.textRank + rrfK)
          }
          return { ...entry, rrfScore } as RankedSnippet
        })
        .toArray()
        .toSorted((a, b) => b.rrfScore - a.rrfScore)
    }

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

      async storeSnippets(snippets) {
        if (snippets.length === 0) return

        await client.insert(Schema.snippet).values(snippets)

        console.debug(
          `Stored snippets`,
          inspect(
            {
              snippets: snippets.map((s) => ({
                messageId: s.messageId,
                sequence: s.sequence,
                content: s.content,
              })),
            },
            { depth: null }
          )
        )
      },

      async findRecentMessages({ userId }) {
        const MAX_RECENT_MESSAGES = parseInt(import.meta.env.MAX_RECENT_MESSAGES ?? '10')
        return await client
          .select({
            id: Schema.message.id,
            userId: Schema.message.userId,
            waId: Schema.message.waId,
            type: Schema.message.type,
            role: Schema.message.role,
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
          .orderBy(desc(Schema.message.timestamp))
          .limit(MAX_RECENT_MESSAGES)
          .then((result) => result.toReversed())
      },

      async searchSnippets({ userId, query, queryEmbedding, excludeIds = [] }) {
        const MAX_SIMILAR_MESSAGES = parseInt(import.meta.env.MAX_SIMILAR_MESSAGES ?? '10')
        const RRF_K = parseInt(import.meta.env.RRF_K ?? '10')

        const extraConditions =
          excludeIds.length > 0 ? [notInArray(Schema.message.id, excludeIds)] : []

        const ranked = await hybridSearch({
          userId,
          query,
          queryEmbedding,
          limit: MAX_SIMILAR_MESSAGES * 10,
          rrfK: RRF_K,
          extraConditions,
          joinResource: false,
        })

        // Compute totalChunks for all unique messageIds
        const allMessageIds = Array.from(new Set(ranked.map((r) => r.messageId)))
        const totalChunksByMessage = new Map<string, number>()

        if (allMessageIds.length > 0) {
          const countRows = await client
            .select({
              messageId: Schema.snippet.messageId,
              count: sql<number>`COUNT(*)`,
            })
            .from(Schema.snippet)
            .where(inArray(Schema.snippet.messageId, allMessageIds))
            .groupBy(Schema.snippet.messageId)

          for (const row of countRows) {
            totalChunksByMessage.set(row.messageId, row.count)
          }
        }

        return ranked.slice(0, MAX_SIMILAR_MESSAGES).map(
          (entry) =>
            ({
              id: entry.snippetId,
              content: entry.content,
              role: entry.role as DB.MessageRole,
              type: entry.type as DB.MessageType,
              timestamp: entry.timestamp,
              sequence: entry.sequence,
              total: totalChunksByMessage.get(entry.messageId) ?? 1,
            } satisfies DB.SimilarSnippet)
        )
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
        return client
          .select()
          .from(Schema.resource)
          .where(and(eq(Schema.resource.userId, userId), eq(Schema.resource.id, resourceId)))
          .limit(1)
          .then(([result]) => result)
      },

      async findResourceIdByHash({ userId, hash }) {
        return client
          .select({ id: Schema.resource.id })
          .from(Schema.resource)
          .where(and(eq(Schema.resource.userId, userId), eq(Schema.resource.hash, hash)))
          .limit(1)
          .then(([result]) => result?.id)
      },

      async searchResources({ userId, query, queryEmbedding }) {
        const MAX_FILES = parseInt(import.meta.env.FILE_SEARCH_LIMIT ?? '5')
        const RRF_K = parseInt(import.meta.env.RRF_K ?? '10')

        const ranked = await hybridSearch({
          userId,
          query,
          queryEmbedding,
          limit: MAX_FILES * 10,
          rrfK: RRF_K,
          extraConditions: [isNotNull(Schema.message.resourceId)],
          joinResource: true,
        })

        // Group by resourceId
        const groups = new Map<
          string,
          {
            resourceId: string
            filename: string | null
            timestamp: Date
            snippets: Array<{ content: string; rrfScore: number }>
          }
        >()

        for (const row of ranked) {
          const key = row.resourceId!
          const existing = groups.get(key)
          if (existing) {
            existing.snippets.push({ content: row.content, rrfScore: row.rrfScore })
          } else {
            groups.set(key, {
              resourceId: key,
              filename: row.filename,
              timestamp: row.timestamp,
              snippets: [{ content: row.content, rrfScore: row.rrfScore }],
            })
          }
        }

        // Calculate score from best snippet, build combined snippet from top 3
        return Array.from(groups.values())
          .map((group) => {
            const sortedSnippets = group.snippets.toSorted((a, b) => b.rrfScore - a.rrfScore)
            const score = sortedSnippets[0]?.rrfScore ?? 0
            const snippet = sortedSnippets
              .slice(0, 3)
              .map((s) => s.content)
              .join('\n\n')

            return {
              resourceId: group.resourceId,
              filename: group.filename,
              timestamp: group.timestamp,
              score,
              snippet,
            }
          })
          .toSorted((a, b) => b.score - a.score)
          .slice(0, MAX_FILES)
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
        const SENDING_STALE_SECONDS = parseInt(
          import.meta.env.REMINDER_SENDING_STALE_SECONDS ?? '300'
        )
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
