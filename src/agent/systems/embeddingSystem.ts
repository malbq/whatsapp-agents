import { splitIntoChunks } from '../../utils/splitIntoChunks'
import type { Frame } from '../frame'

export async function EmbeddingSystem(frame: Frame, deps: Deps) {
  const messages = frame.query(['Message', 'TextContent'])

  const messagesToProcess = []
  const allChunks = []

  const messageData = await Promise.all(
    messages.map(async (messageEntity) => {
      const vectorEmbedding = frame.getComponent(messageEntity, 'VectorEmbedding')
      if (vectorEmbedding) return null

      const textContent = frame.getComponent(messageEntity, 'TextContent')!
      const chunks = await splitIntoChunks(textContent.text)

      return {
        entity: messageEntity,
        chunks,
      }
    })
  )

  for (const data of messageData) {
    if (!data) continue

    messagesToProcess.push({
      entity: data.entity,
      chunks: data.chunks,
      startIndex: allChunks.length,
    })

    allChunks.push(...data.chunks)
  }

  if (allChunks.length === 0) return

  const embeddings = await deps.ai.generateEmbeddings({ text: allChunks })

  for (const { entity, chunks, startIndex } of messagesToProcess) {
    const chunkData = chunks.map((content, i) => ({
      content,
      embedding: embeddings[startIndex + i]!,
    }))

    frame.addComponent(entity, 'VectorEmbedding', { chunks: chunkData })
  }
}
