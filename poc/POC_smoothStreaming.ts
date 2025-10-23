import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { smoothStream, streamText } from 'ai'
import { styleText } from 'node:util'

const cfAccountId = import.meta.env.CF_ACCOUNT_ID
const cfGatewayId = import.meta.env.CF_GATEWAY_ID
const cfApiToken = import.meta.env.CF_API_TOKEN

const provider = createOpenAICompatible({
  name: 'cf-ai-gateway',
  baseURL: `https://gateway.ai.cloudflare.com/v1/${cfAccountId}/${cfGatewayId}/compat`,
  headers: { 'cf-aig-authorization': `Bearer ${cfApiToken}` },
})

const chunkingRegex = /<S>/

const result = streamText({
  model: provider('openai/gpt-5-mini'),
  prompt: `Write a detailed essay about the history of programming languages.
Use rich markdown formatting.
For responses longer than 500 characters, split into chunks of around 500 characters each.
Use the pattern <S> to mark the border between chunks.
Split at natural sentence boundaries.
Plan before splitting; avoid splitting in the middle of lists and quotes.`,
  experimental_transform: smoothStream({
    delayInMs: null,
    chunking(buffer) {
      const match = chunkingRegex.exec(buffer)
      if (!match) return null
      return buffer.slice(0, match.index) + match?.[0]
    },
  }),
})

for await (const delta of result.textStream) {
  if (delta) {
    console.log(styleText(['bold', 'green'], `--- (${delta.length} chars) ---`))
    console.log(delta.replace('<S>', '').trim())
  }
}
