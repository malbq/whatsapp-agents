import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { getLogger } from '@logtape/logtape'
import { generateText, tool } from 'ai'
import { z } from 'zod'
import type { Frame } from '../frame'
import { toolUsageExplanation } from '../prompts/toolUsageExplanation'

const logger = getLogger(['app', 'agent', 'tool', 'webSearch'])

const google = createGoogleGenerativeAI({
  baseURL: `https://gateway.ai.cloudflare.com/v1/${import.meta.env.CF_ACCOUNT_ID}/${
    import.meta.env.CF_GATEWAY_ID
  }/google-ai-studio/v1beta`,
  apiKey: import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY,
  headers: { 'cf-aig-authorization': `Bearer ${import.meta.env.CF_API_TOKEN}` },
})

const searchModel = google('gemini-2.5-flash')

export const webSearchTool = (frame: Frame, deps: Deps) =>
  tool({
    name: 'web_search',
    description: `Search the web for current information, facts, news, or any real-time data.
Use this tool to discover sources and get fresh information when no specific URL is provided.
Do not use this tool if the user's message contains a URL (http:// or https://).

Use this tool when the user asks about:
- Current events, news, or recent developments
- Facts or information not in your knowledge base
- Business information, contact details, or locations
- Product prices, availability, or reviews
- Weather, sports scores, or other real-time data
- Any question that requires up-to-date information from the internet

Returns a summary answer.`,
    inputSchema: z.object({
      query: z.string().describe('The search query to find relevant information on the web.'),
      explanation: z.string().describe(toolUsageExplanation),
    }),
    execute: async (params) => {
      const { query, explanation } = params

      const externalChatId = await deps.chat.sendText({ text: explanation })
      frame.outboundMessages.push({
        externalChatId,
        type: 'text',
        text: explanation,
      })

      const urlMatch = query.match(/https?:\/\/\S+/i)
      if (urlMatch) {
        const url = urlMatch[0]
        logger.warn('web_search: URL detected in query, suggest web_fetch', {
          ...params,
          detectedUrl: url,
        })
        return `Use web_fetch to open this URL directly:\n${url}`
      }

      const result = await generateText({
        model: searchModel,
        system: webSearchPrompt,
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
          .filter((url: string, index: number, self: string[]) => self.indexOf(url) === index)

        if (urls.length > 0) {
          response +=
            '\n\nSources:\n' + urls.map((url: string, i: number) => `${i + 1}. ${url}`).join('\n')
        }
      }
      logger.info('web_search: completed', {
        ...params,
        responseLength: result.text.length,
        sourcesCount:
          groundingMetadata?.groundingChunks?.filter((c: any) => c.web?.uri).length ?? 0,
        usage: result.usage,
      })
      logger.debug('web_search: results', {
        ...params,
        searchQueries: groundingMetadata?.webSearchQueries,
        response,
      })

      return response
    },
  })

const webSearchPrompt = `You are a web search assistant. Search the web for information about the user's query and provide a comprehensive, accurate answer.

IMPORTANT: At the end of your answer, include a "Sources:" section with a numbered list of URLs you used.

Format your answer to be:
- Clear and concise
- Factual and accurate
- Well-structured with relevant details
- Based on current, reliable sources

If you cannot find relevant information, state that clearly.`
