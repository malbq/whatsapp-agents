import { tool } from 'ai'
import { z } from 'zod'
import type { ToolExecutionError } from '../errors'
import type { SimilarMessage } from '../infra/db'
import { spreadError } from '../utils/spreadError'
import { extractFilename } from '../utils/storageKey'

export interface FetchMemoryDeps {
  userId: string
  generateEmbeddings: (texts: Array<string>) => Promise<Array<Array<{ embedding: Array<number> }>>>
  findSimilarMessages: (params: {
    userId: string
    queryEmbedding: Array<number>
    excludeIds?: Array<string>
  }) => Promise<Array<SimilarMessage>>
  onExplanation?: (explanation: string) => Promise<void> | void
  acknowledgeInboundMessage?: () => Promise<void> | void
}

export function createFetchMemoryTool(deps: FetchMemoryDeps, explanationPrompt: string) {
  return tool({
    name: 'fetch_memory',
    description: `Fetch relevant memories from conversation history to provide context-aware and personalized responses.
Generate an optimized search query for finding relevant files and documents.`,
    inputSchema: z.object({
      query: z.string().describe('The query to search for relevant memories'),
      explanation: z.string().describe(explanationPrompt),
    }),
    execute: async (params) => {
      try {
        const { query, explanation } = params

        await deps.onExplanation?.(explanation)
        await deps.acknowledgeInboundMessage?.()

        const [embeddings] = await deps.generateEmbeddings([query])

        const recentMessageIds: string[] = []
        const similarMessages = await deps.findSimilarMessages({
          userId: deps.userId,
          queryEmbedding: embeddings![0]!.embedding,
          excludeIds: recentMessageIds,
        })

        console.log('fetch_memory completed', {
          ...params,
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
          filename: extractFilename(message.storageKey),
        }))
      } catch (error) {
        console.error('fetch_memory failed', {
          ...params,
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
