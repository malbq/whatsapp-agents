import { tool } from 'ai'
import { z } from 'zod'
import { generateEmbeddings } from '../ai/generateEmbeddings'
import type { ToolExecutionError } from '../errors'
import type { DB } from '../infra/db'
import { spreadError } from '../utils/spreadError'
import { extractFilename } from '../utils/storageKey'

export interface FetchMemoryContext {
  userId: string
  findSimilarMessages: DB['findSimilarMessages']
}

export function createFetchMemoryTool(ctx: FetchMemoryContext) {
  return tool({
    name: 'fetch_memory',
    description: `Fetch relevant memories from conversation history to provide context-aware and personalized responses.
Generate an optimized search query for finding relevant files and documents.`,
    inputSchema: z.object({
      query: z.string().describe('The query to search for relevant memories'),
    }),
    execute: async ({ query }) => {
      try {
        const [embeddings] = await generateEmbeddings([query])

        const recentMessageIds: string[] = []
        const similarMessages = await ctx.findSimilarMessages({
          userId: ctx.userId,
          queryEmbedding: embeddings![0]!.embedding,
          excludeIds: recentMessageIds,
        })

        console.log('fetch_memory completed', {
          query,
          resultsCount: similarMessages.length,
          excludedRecentCount: recentMessageIds.length,
        })
        console.debug('fetch_memory results', { query, similarMessages })

        return similarMessages.map((message) => ({
          role: message.role,
          type: message.type,
          content: message.content,
          chunk: `${message.chunkSequence} of ${message.totalChunks}`,
          timestamp: message.timestamp.toISOString(),
          filename: extractFilename(message.storageKey), // FIXME we should be storing original filename, not relying in storage key
        }))
      } catch (error) {
        console.error('fetch_memory failed', {
          query,
          ...spreadError(error),
        })
        return {
          error: 'Tool execution failed',
          details: error instanceof Error ? error.message : 'unknown',
        } satisfies ToolExecutionError
      }
    },
  })
}
