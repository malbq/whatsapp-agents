import { getLogger } from '@logtape/logtape'
import { tool } from 'ai'
import { z } from 'zod'
import { extractFilename } from '../../utils/storageKey'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'tool', 'searchFiles'])

export const searchFilesTool = (frame: Frame, deps: Deps) =>
  tool({
    name: 'search_files',
    description: `Search for files based on content similarity.
    Use this when the user asks about documents, files, or specific information that might be stored in uploaded files.
    Returns results with a score property (0-1) indicating relevance, where higher scores mean better similarity to the query.
    Generate an optimized search query for finding relevant files and documents.`,
    inputSchema: z.object({
      query: z.string().describe('The query to search for files'),
    }),
    execute: async ({ query }) => {
      logger.info(`Searching for files matching the query: ${query}`)
      const embeddings = await deps.ai.generateEmbeddings(query)

      const files = await deps.db.searchFiles({
        userId: frame.user!.id,
        queryEmbedding: embeddings[0]!.embedding,
      })

      logger.info(`Found ${files.length} files`, {
        files: files.map((file) => ({
          filename: extractFilename(file.storageKey),
          timestamp: file.timestamp,
          score: file.score,
        })),
      })
      logger.debug(`File search results`, { files })

      const output = files.map((file) => ({
        messageId: file.messageId,
        filename: extractFilename(file.storageKey),
        timestamp: file.timestamp,
        snippet: file.snippet,
        score: file.score,
      }))

      frame.lastSearchFiles = output.map((file) => ({
        messageId: file.messageId,
        filename: file.filename,
      }))

      return output
    },
  })
