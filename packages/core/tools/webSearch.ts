import { tool } from 'ai'
import { z } from 'zod'
import type { ToolExecutionError } from '../errors'
import type { WebSearch } from '../infra/webSearch'

export interface WebSearchContext {
  webSearch: WebSearch
  beforeExecution?: () => void
  afterExecution?: () => void
}

export function createWebSearchTool(ctx: WebSearchContext) {
  return tool({
    title: 'web_search',
    description: `Search the web for current/external information (news, facts, prices, business info, etc.).
Use when the answer depends on up-to-date internet sources.
If the user's message includes a URL, do not use this tool; call \`web_fetch\` directly.
After discovering relevant URLs, use \`web_fetch\` to retrieve full content when needed.`,
    inputSchema: z.object({
      query: z.string().describe('The search query to find relevant information on the web.'),
    }),
    execute: async (params, { abortSignal }) => {
      ctx.beforeExecution?.()
      console.log('web_search tool execution', params)

      try {
        const { query } = params

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

        const results = await ctx.webSearch({ query, signal: abortSignal })
        console.debug('web_search results', {
          query,
          resultsCount: results.length,
        })

        if (results.length === 0) {
          console.warn('web_search no results', { query })
          return 'No relevant search results found for your query.'
        }

        return results
      } catch (error) {
        console.error('web_search execution failed', {
          ...params,
          error,
        })
        return {
          error: 'Tool execution failed',
          details: error instanceof Error ? error.message : 'unknown',
        } satisfies ToolExecutionError
      } finally {
        ctx.afterExecution?.()
      }
    },
  })
}
