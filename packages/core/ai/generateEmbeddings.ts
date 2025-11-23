import { createOpenAI } from '@ai-sdk/openai'
import { embedMany } from 'ai'
import { inspect } from 'node:util'
import { createCloudflareCompatibleFetch } from '../utils/cloudflareFetch'
import { splitIntoChunks } from '../utils/splitIntoChunks'

export interface ChunkData {
  content: string
  embedding: Array<number>
}
export interface GenerateEmbeddings {
  (text: Array<string>): Promise<Array<Array<ChunkData>>>
}

const accountId = import.meta.env.CF_ACCOUNT_ID

export const cfProvider = createOpenAI({
  baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
  apiKey: import.meta.env.CF_API_TOKEN,
  fetch: createCloudflareCompatibleFetch(fetch),
})

const embeddingModel = cfProvider.textEmbeddingModel('@cf/google/embeddinggemma-300m')
const CHUNK_SIZE = 4096

export const generateEmbeddings: GenerateEmbeddings = async (texts) => {
  const groupedChunks = await Promise.all(
    texts.map(async (text) => {
      if (!text.trim()) {
        return []
      }
      return await splitIntoChunks(text, CHUNK_SIZE)
    })
  )

  const allChunks = groupedChunks.flat()
  const result = await embedMany({
    model: embeddingModel,
    values: allChunks,
  })

  console.debug(
    `Batch embeddings generated with ${embeddingModel.provider}/${embeddingModel.modelId}`,
    inspect(
      {
        input: texts,
        totalChunks: allChunks.length,
        usage: result.usage,
        responseHeaders: result.responses?.[0]?.headers,
      },
      { depth: null }
    )
  )

  let embeddingIndex = 0
  const embeddings = groupedChunks.map<Array<ChunkData>>((textChunks) => {
    const embedding = result.embeddings
      .slice(embeddingIndex, embeddingIndex + textChunks.length)
      .map((embedding, e) => ({
        content: textChunks[e]!,
        embedding,
      }))
    embeddingIndex += textChunks.length
    return embedding
  })

  return embeddings
}
