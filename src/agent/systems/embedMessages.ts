import { getLogger } from '@logtape/logtape'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'messageEmbedding'])

export async function embedMessages(frame: Frame, deps: Deps) {
  const textsToEmbed: Array<string> = []

  if (frame.inbound?.text) {
    textsToEmbed.push(frame.inbound.text)
  }
  if (frame.inbound?.media?.transcription) {
    textsToEmbed.push(frame.inbound.media.transcription)
  }
  if (frame.outbound?.text) {
    textsToEmbed.push(frame.outbound.text)
  }

  if (textsToEmbed.length === 0) {
    logger.warn('No message to embed')
    return
  }

  const embeddings = await deps.ai.generateEmbeddings(textsToEmbed)

  if (frame.outbound?.text) {
    frame.outbound.textEmbedding = embeddings.pop()
  }
  if (frame.inbound?.media?.transcription) {
    frame.inbound.media.transcriptionEmbedding = embeddings.pop()
  }
  if (frame.inbound?.text) {
    frame.inbound.textEmbedding = embeddings.pop()
  }
}
