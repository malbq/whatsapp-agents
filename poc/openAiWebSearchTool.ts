import { openai } from '@ai-sdk/openai'
import { generateText } from 'ai'

/**
 * OpenAI só acessa URLs se web_search estiver ativado.
 * gpt-4.1-nano não suporta web_search_preview.
 */
const response = await generateText({
  model: openai('gpt-4.1-mini'),
  system: `read website content and try to answer user's request.
If you can't read the information, say so.`,
  prompt: `https://www.tudogostoso.com.br/receita/23-bolo-de-cenoura.html
você consegue ler o conteúdo dessa página? qual a lista de ingredientes?`,
  tools: {
    web_search_preview: openai.tools.webSearchPreview({
      searchContextSize: 'low',
    }),
  },
})

console.log(JSON.stringify(response.toolCalls, null, 2))
console.log(JSON.stringify(response.toolResults, null, 2))
