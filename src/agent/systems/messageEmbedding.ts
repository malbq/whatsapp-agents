import { getLogger } from '@logtape/logtape'
import type { ChunkData } from '../../infra/db'
import { splitIntoChunks } from '../../utils/splitIntoChunks'
import type { FrameMessage } from '../frame'

const logger = getLogger(['app', 'agent', 'messageEmbedding'])

export async function MessageEmbedding(deps: Deps, message?: FrameMessage) {
  if (!message) {
    logger.warn('No message to embed')
    return
  }

  if (message.text && message.text.trim()) {
    const chunks = await splitIntoChunks(message.text)
    const embeddings = await deps.ai.generateEmbeddings({ text: chunks })
    message.textEmbedding = chunks.map<ChunkData>((content, i) => ({
      content,
      embedding: embeddings[i]!,
    }))
  }

  if (message.media?.transcription && message.media.transcription.trim()) {
    const transcriptionChunks = await splitIntoChunks(message.media.transcription)
    const transcriptionEmbeddings = await deps.ai.generateEmbeddings({ text: transcriptionChunks })
    message.media.transcriptionEmbedding = transcriptionChunks.map<ChunkData>((content, i) => ({
      content,
      embedding: transcriptionEmbeddings[i]!,
    }))
  }
}
