import { OpenAI } from 'openai'
const client = new OpenAI()

/**
 * OpenAI só acessa URLs se web_search estiver ativado.
 * gpt-4.1-nano não suporta web_search_preview.
 */
const response = await client.responses.create({
  model: 'gpt-4.1-mini',
  instructions: `read website content and try to answer user's request.
If you can't read the information, say so.`,
  input: `https://www.tudogostoso.com.br/receita/23-bolo-de-cenoura.html
você consegue ler o conteúdo dessa página? qual a lista de ingredientes?`,
  store: false,
  tools: [
    {
      type: 'web_search_preview',
    },
  ],
})

console.log(JSON.stringify(response, null, 2))
