const model = '@cf/baai/bge-small-en-v1.5'

interface EmbeddingsResponseBody {
  result: EmbeddingsOutput
  success: boolean
  error: string[]
  messages: string[]
}
interface EmbeddingsOutput {
  shape: number[]
  data: number[][]
  pooling: 'mean' | 'cls'
}
export async function generateEmbeddings(text: string | string[]) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${model}`,
    {
      headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}` },
      method: 'POST',
      body: JSON.stringify({ text }),
    }
  )
  console.log('CF embed request', response.statusText)
  const responseBody = (await response.json()) as EmbeddingsResponseBody
  console.log(`generated embeddings with ${model}`, responseBody.result.shape)
  return responseBody.result.data
}
