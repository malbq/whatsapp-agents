import { tool } from 'ai'
import { z } from 'zod'
import type { ToolExecutionError } from '../../../core/errors'
import type { RecentMessage } from '../../../core/infra/db'
import { spreadError } from '../../../core/utils/spreadError'
import { extractFilename } from '../../../core/utils/storageKey'
import { toolUsageExplanation } from '../../zapid/prompts/toolUsageExplanation'
import type { Frame } from '../frame'

// //const logger = getLogger(['app', 'agent', 'tool', 'fetchMemory'])

export const fetchMemoryTool = (frame: Frame, deps: Deps, recentMessages: RecentMessage[] = []) =>
  tool({
    name: 'fetch_memory',
    description: `Fetch relevant memories from conversation history to provide context-aware and personalized responses.
Generate an optimized search query for finding relevant files and documents.`,
    inputSchema: z.object({
      query: z.string().describe('The query to search for relevant memories'),
      explanation: z.string().describe(toolUsageExplanation),
    }),
    execute: async (params) => {
      try {
        const { query, explanation } = params

        if (!frame.user) {
          console.error('missing user', params)
          return {
            error: 'Missing user',
            details: 'Could not fetch memory due to missing user',
          } satisfies ToolExecutionError
        }

        const externalChatId = await deps.chat.sendText({ text: explanation })
        if (frame.inbound?.externalChatId) {
          await deps.chat.acknowledgeMessage(frame.inbound?.externalChatId)
        }
        frame.outboundMessages.push({
          externalChatId,
          type: 'text',
          text: explanation,
        })

        const [embeddings] = await deps.ai.generateEmbeddings([query])

        const similarMessages = await deps.db.findSimilarMessages({
          userId: frame.user.id,
          queryEmbedding: embeddings![0]!.embedding,
          excludeIds: recentMessages.map((message) => message.id),
        })

        console.log('completed', {
          ...params,
          resultsCount: similarMessages.length,
          excludedRecentCount: recentMessages.length,
        })
        console.debug('results', { query, similarMessages })

        return similarMessages.map((message) => ({
          role: message.role,
          type: message.type,
          content: message.content,
          chunk: `${message.chunkSequence} of ${message.totalChunks}`,
          timestamp: message.timestamp.toISOString(),
          filename: extractFilename(message.storageKey),
        }))
      } catch (error) {
        console.error('Tool execution failed', {
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
