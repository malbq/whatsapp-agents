import { embedMany } from 'ai'

import { createOpenAI } from '@ai-sdk/openai'
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

const embeddingModel = cfProvider.textEmbeddingModel('@cf/baai/bge-m3')

export const generateEmbeddings: GenerateEmbeddings = async (texts) => {
  const groupedChunks = await Promise.all(
    texts.map(async (text) => {
      if (!text.trim()) {
        return []
      }
      return await splitIntoChunks(text)
    })
  )

  const allChunks = groupedChunks.flat()
  const result = await embedMany({
    model: embeddingModel,
    values: allChunks,
  })

  console.debug(`Batch embeddings generated with ${embeddingModel.modelId}`, {
    textsCount: texts.length,
    totalChunks: allChunks.length,
    embeddings: result.embeddings.map((e) => e.length),
    usage: result.usage,
    providerMetadata: result.providerMetadata,
  })

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
