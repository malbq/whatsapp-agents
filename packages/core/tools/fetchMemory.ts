import { tool } from 'ai'
import { ok } from 'node:assert'
import { inspect } from 'node:util'
import { z } from 'zod'
import { generateEmbeddings } from '../ai/generateEmbeddings'
import type { ToolExecutionError } from '../errors'
import type { DB } from '../infra/db'
import { spreadError } from '../utils/spreadError'

export interface FetchMemoryContext {
  userId: string
  recentMessageIds: Array<string>
  findSimilarSnippets: DB.Repository['findSimilarSnippets']
}

export function createFetchMemoryTool(ctx: FetchMemoryContext) {
  return tool({
    title: 'fetch_memory',
    description: `Fetch relevant memories from conversation history to provide context-aware and personalized responses.
Generate an optimized search query for finding relevant files and documents.
Examples: 
- User query: "What is the secret door code I told you earlier?"
- Use \`fetch_memory\` tool with query "secret door code"`,
    inputSchema: z.object({
      query: z.string().describe('The query to search for relevant memories'),
    }),
    execute: async ({ query }) => {
      try {
        const [embeddings] = await generateEmbeddings([query])
        const queryEmbedding = embeddings?.[0]?.embedding
        ok(queryEmbedding, 'Query embedding not generated')

        const similarMessages = await ctx.findSimilarSnippets({
          userId: ctx.userId,
          query,
          queryEmbedding: embeddings![0]!.embedding,
          excludeIds: ctx.recentMessageIds,
        })

        console.log('fetch_memory completed', {
          query,
          resultsCount: similarMessages.length,
          excludedRecentCount: ctx.recentMessageIds.length,
        })
        console.debug('fetch_memory results', inspect({ query, similarMessages }, { depth: null }))

        return similarMessages.map((message) => ({
          type: message.type,
          content: message.content,
          chunk: message.total > 1 ? `${message.sequence} of ${message.total}` : undefined,
          timestamp: message.timestamp.toISOString(),
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
