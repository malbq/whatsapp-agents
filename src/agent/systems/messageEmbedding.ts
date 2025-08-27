import type { ChunkData } from '../../infra/db'
import { splitIntoChunks } from '../../utils/splitIntoChunks'
import type { FrameMessage } from '../frame'

export async function MessageEmbedding(deps: Deps, message?: FrameMessage) {
  if (!message?.text) return

  const chunks = await splitIntoChunks(message.text)
  const embeddings = await deps.ai.generateEmbeddings({ text: chunks })
  message.embeddedContent = chunks.map<ChunkData>((content, i) => ({
    content,
    embedding: embeddings[i]!,
  }))
}
