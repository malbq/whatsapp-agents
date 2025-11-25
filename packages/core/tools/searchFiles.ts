import type { ToolExecutionError } from '@batman/core/errors'
import { spreadError } from '@batman/core/utils/spreadError'
import { tool } from 'ai'
import { ok } from 'node:assert'
import { inspect } from 'node:util'
import { z } from 'zod'
import { generateEmbeddings } from '../ai/generateEmbeddings'
import type { DB } from '../infra/db'

export interface SearchFilesContext {
  userId: string
  searchResources: DB.Repository['searchResources']
}

export function createSearchFilesTool(ctx: SearchFilesContext) {
  return tool({
    title: 'search_files',
    description: `Search for files based on content similarity.
Use when the user asks about documents, files, or specific information that might be stored in uploaded files.
Generate an optimized search query to find the most relevant files.
Returns results with a score (0-1) indicating relevance.
After reviewing results: if one file is clearly relevant, call \`send_file\` with its resourceId.
If several are close, ask a clarifying question or present the list for selection.
`,
    inputSchema: z.object({
      query: z.string().describe('The query to search for files'),
    }),
    execute: async ({ query }) => {
      console.debug('search_files query:', query)
      try {
        const [embeddings] = await generateEmbeddings([query])
        const queryEmbedding = embeddings?.[0]?.embedding
        ok(queryEmbedding, 'Query embedding not generated')

        const files = await ctx.searchResources({
          userId: ctx.userId,
          query,
          queryEmbedding,
        })

        console.debug(
          'search_files results',
          inspect(
            {
              query,
              filesCount: files.length,
              topScore: files[0]?.score ?? 0,
              files,
            },
            { depth: null }
          )
        )

        return files
      } catch (error) {
        console.error('search_files failed', {
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
