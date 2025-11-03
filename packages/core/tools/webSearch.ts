import { tool } from 'ai'
import { z } from 'zod'
import type { ToolExecutionError } from '../errors'
import { spreadError } from '../utils/spreadError'

export interface WebSearchResult {
  title: string
  url: string
  description: string
}

export interface WebSearchContext {
  webSearch: (params: { query: string; signal?: AbortSignal }) => Promise<Array<WebSearchResult>>
  onExplanation?: (explanation: string) => Promise<void> | void
}

export function createWebSearchTool(ctx: WebSearchContext, explanationPrompt: string) {
  return tool({
    name: 'web_search',
    description: `Search the web for current/external information (news, facts, prices, business info, etc.).
Use when the answer depends on up-to-date internet sources.
If the user's message includes a URL, do not use this tool; call \`web_fetch\` directly.
After discovering relevant URLs, use \`web_fetch\` to retrieve full content when needed.`,
    inputSchema: z.object({
      query: z.string().describe('The search query to find relevant information on the web.'),
      explanation: z.string().describe(explanationPrompt),
    }),
    execute: async (params, { abortSignal }) => {
      console.log('starting web_search tool execution', params)

      try {
        const { query, explanation } = params

        await ctx.onExplanation?.(explanation)

        const urlMatch = query.match(/https?:\/\/\S+/i)
        if (urlMatch) {
          const url = urlMatch[0]
          console.warn('URL detected in query, suggest web_fetch', {
            ...params,
            detectedUrl: url,
          })
          return {
            error: 'URL detected in query',
            details: `Use \`web_fetch\` tool to open this URL: ${url}`,
          } satisfies ToolExecutionError
        }

        console.debug('calling webSearch dependency', { query })
        const results = await ctx.webSearch({ query, signal: abortSignal })
        console.debug('webSearch dependency returned', {
          query,
          resultsCount: results.length,
        })

        if (results.length === 0) {
          console.warn('no results returned from search', { query })
          return 'No relevant search results found for your query.'
        }

        console.log('completed successfully', {
          ...params,
          resultsCount: results.length,
        })
        console.debug('results', {
          ...params,
          searchResults: results,
        })

        return results
      } catch (error) {
        console.error('tool execution failed', {
          ...params,
          error: spreadError(error),
        })
        return {
          error: 'Tool execution failed',
          details: error instanceof Error ? error.message : 'unknown',
        } satisfies ToolExecutionError
      }
    },
  })
}
