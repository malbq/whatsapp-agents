import { getLogger } from '@logtape/logtape'
import { tool } from 'ai'
import { z } from 'zod'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'tool', 'searchFiles'])

export const searchFilesTool = (frame: Frame, deps: Deps) =>
  tool({
    description: `Search for files based on content similarity.
    Use this when the user asks about documents, files, or specific information that might be stored in uploaded files.
    Returns results with a score property (0-1) indicating relevance, where higher scores mean better similarity to the query.
    Generate an optimized search query for finding relevant files and documents.`,
    inputSchema: z.object({
      query: z.string().describe('The query to search for files'),
    }),
    execute: async ({ query }) => {
      const embeddings = await deps.ai.generateEmbeddings(query)

      const results = await deps.db.searchFiles({
        userId: frame.user!.id,
        queryEmbedding: embeddings[0]!.embedding,
      })

      logger.info(`Found ${results.length} files matching the query`)
      logger.debug(`Files`, { ...results })

      return results.map((file) => ({
        storageKey: file.storageKey,
        timestamp: file.timestamp,
        snippet: file.snippet,
        score: file.score,
      }))
    },
  })
