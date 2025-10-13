import { getLogger } from '@logtape/logtape'
import { tool } from 'ai'
import { z } from 'zod'
import { extractFilename } from '../../utils/storageKey'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'tool', 'fetchMemory'])

export const fetchMemoryTool = (frame: Frame, deps: Deps) =>
  tool({
    name: 'fetch_memory',
    description: `Fetch relevant memories from conversation history to provide context-aware and personalized responses.
    Generate an optimized search query for finding relevant files and documents.`,
    inputSchema: z.object({
      query: z.string().describe('The query to search for relevant memories'),
    }),
    execute: async ({ query }) => {
      if (!frame.user) return 'Could not fetch memory due to missing user'

      const embeddings = await deps.ai.generateEmbeddings(query)

      const similarMessages = await deps.db.findSimilarMessages({
        userId: frame.user.id,
        queryEmbedding: embeddings[0]!.embedding,
        // TODO: excludeIds: recentMessages.map((message) => message.id),
      })

      logger.info(`Context: similar messages (${similarMessages.length})`)

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
