import { getLogger } from '@logtape/logtape'
import { tool } from 'ai'
import { z } from 'zod'
import type { RecentMessage } from '../../infra/db'
import { extractFilename } from '../../utils/storageKey'
import type { Frame } from '../frame'
import { toolUsageExplanation } from '../prompts/toolUsageExplanation'

const logger = getLogger(['app', 'agent', 'tool', 'fetchMemory'])

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
      const { query, explanation } = params

      if (!frame.user) {
        logger.error('fetch_memory: missing user', params)
        return 'Could not fetch memory due to missing user'
      }

      const externalChatId = await deps.chat.sendText({ text: explanation })
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

      logger.info('fetch_memory: completed', {
        ...params,
        resultsCount: similarMessages.length,
        excludedRecentCount: recentMessages.length,
      })
      logger.debug('fetch_memory: results', { query, similarMessages })

      return similarMessages.map((message) => ({
        role: message.role,
        type: message.type,
        content: message.content,
        chunk: `${message.chunkSequence} of ${message.totalChunks}`,
        timestamp: message.timestamp.toISOString(),
        filename: extractFilename(message.storageKey),
      }))
    },
  })
