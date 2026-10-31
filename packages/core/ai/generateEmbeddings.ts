import { createOpenAI } from '@ai-sdk/openai'
import { embedMany, type EmbeddingModel } from 'ai'
import { splitIntoChunks } from '../utils/splitIntoChunks'

export interface ChunkData {
  content: string
  embedding: Array<number>
}
export interface GenerateEmbeddings {
  (text: Array<string>): Promise<Array<Array<ChunkData>>>
}

const CHUNK_SIZE = 4096

/** Workers AI exposes an OpenAI-compatible API; vectors are 768-dimensional to match the schema. */
export function createCloudflareEmbeddingModel({
  accountId,
  apiToken,
  modelId = '@cf/google/embeddinggemma-300m',
}: {
  accountId: string
  apiToken: string
  modelId?: string
}): EmbeddingModel {
  const provider = createOpenAI({
    baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
    apiKey: apiToken,
  })
  return provider.embeddingModel(modelId)
}

export const createGenerateEmbeddings =
  ({ model }: { model: EmbeddingModel }): GenerateEmbeddings =>
  async (texts) => {
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
      model,
      values: allChunks,
      telemetry: {
        functionId: 'generateEmbeddings',
        isEnabled: true,
      },
    })

    console.debug(`Batch embeddings generated`, { chunks: allChunks.length })

    let embeddingIndex = 0
    return groupedChunks.map<Array<ChunkData>>((textChunks) => {
      const chunkData = result.embeddings
        .slice(embeddingIndex, embeddingIndex + textChunks.length)
        .map((embedding, e) => ({
          content: textChunks[e]!,
          embedding,
        }))
      embeddingIndex += textChunks.length
      return chunkData
    })
  }
