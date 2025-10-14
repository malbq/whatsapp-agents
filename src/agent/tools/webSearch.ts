import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { getLogger } from '@logtape/logtape'
import { generateText, tool } from 'ai'
import { z } from 'zod'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'tool', 'webSearch'])

const google = createGoogleGenerativeAI({
  baseURL: `https://gateway.ai.cloudflare.com/v1/${import.meta.env.CF_ACCOUNT_ID}/${
    import.meta.env.CF_GATEWAY_ID
  }/google-ai-studio/v1beta`,
  apiKey: import.meta.env.GOOGLE_AI_STUDIO_API_KEY,
  headers: { 'cf-aig-authorization': `Bearer ${import.meta.env.CF_API_TOKEN}` },
})

const searchModel = google('gemini-2.5-flash')

export const webSearchTool = (_frame: Frame, _deps: Deps) =>
  tool({
    name: 'web_search',
    description: `Search the web for current information, facts, news, or any real-time data.
    Use this tool when the user asks about:
    - Current events, news, or recent developments
    - Facts or information not in your knowledge base
    - Business information, contact details, or locations
    - Product prices, availability, or reviews
    - Weather, sports scores, or other real-time data
    - Any question that requires up-to-date information from the internet
    
    Routing:
    - If the user's message contains a URL (http:// or https://), do not use this tool. Use web_fetch with that URL directly.
    - Use this tool to discover sources and get fresh information when no specific URL is provided.
    
    Returns a summary answer and a "Sources:" list of URLs. Use the web_fetch tool to retrieve full content from those URLs if you need more detail.`,
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          'The search query to find relevant information on the web. Do not pass a URL here; if a URL is provided, call web_fetch instead.'
        ),
    }),
    execute: async ({ query }) => {
      logger.info(`Web search query: ${query}`)

      const urlMatch = query.match(/https?:\/\/\S+/i)
      if (urlMatch) {
        const url = urlMatch[0]
        logger.debug('web_search: URL detected in query; deferring to web_fetch', { url })
        return `Use web_fetch to open this URL directly:\n${url}`
      }

      const systemPrompt = `You are a web search assistant. Search the web for information about the user's query and provide a comprehensive, accurate answer.

IMPORTANT: At the end of your answer, include a "Sources:" section with a numbered list of URLs you used.

Format your answer to be:
- Clear and concise
- Factual and accurate
- Well-structured with relevant details
- Based on current, reliable sources

If you cannot find relevant information, state that clearly.`

      const result = await generateText({
        model: searchModel,
        system: systemPrompt,
        prompt: query,
        tools: {
          google_search: google.tools.googleSearch({}),
        },
      })

      const groundingMetadata = result.providerMetadata?.google?.groundingMetadata as any

      let response = result.text

      if (groundingMetadata?.groundingChunks) {
        const urls = groundingMetadata.groundingChunks
          .filter((chunk: any) => chunk.web?.uri)
          .map((chunk: any) => chunk.web.uri)
          .filter((url: string, index: number, self: string[]) => self.indexOf(url) === index) // unique

        if (urls.length > 0) {
          response +=
            '\n\nSources:\n' + urls.map((url: string, i: number) => `${i + 1}. ${url}`).join('\n')
        }
      }
      logger.debug('Web search completed', {
        googleSearchQueries: groundingMetadata?.webSearchQueries,
        answerLength: result.text.length,
        usage: result.usage,
        response,
      })

      return response
    },
  })
