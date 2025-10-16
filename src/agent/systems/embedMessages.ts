import { getLogger } from '@logtape/logtape'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'messageEmbedding'])

export async function embedMessages(frame: Frame, deps: Deps) {
  const textsToEmbed: Array<string> = []

  if (frame.inbound?.text) textsToEmbed.push(frame.inbound.text)
  if (frame.inbound?.media?.transcription) textsToEmbed.push(frame.inbound.media.transcription)

  for (const message of frame.outboundMessages) textsToEmbed.push(message.text)

  if (textsToEmbed.length === 0) {
    logger.warn('No message to embed')
    return
  }

  const embeddings = await deps.ai.generateEmbeddings(textsToEmbed)

  for (let i = frame.outboundMessages.length - 1; i >= 0; i--) {
    frame.outboundMessages[i]!.textEmbedding = embeddings.pop()
  }
  if (frame.inbound?.media?.transcription) {
    frame.inbound.media.transcriptionEmbedding = embeddings.pop()
  }
  if (frame.inbound?.text) {
    frame.inbound.textEmbedding = embeddings.pop()
  }
}
