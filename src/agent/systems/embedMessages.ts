import { getLogger } from '@logtape/logtape'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'messageEmbedding'])

export async function embedMessages(frame: Frame, deps: Deps) {
  if (!frame.inbound && !frame.outbound) {
    logger.warn('No message to embed')
    return
  }

  if (frame.inbound?.text && frame.inbound.text.trim()) {
    frame.inbound.textEmbedding = await deps.ai.generateEmbeddings(frame.inbound.text)
  }

  if (frame.inbound?.media?.transcription && frame.inbound.media.transcription.trim()) {
    frame.inbound.media.transcriptionEmbedding = await deps.ai.generateEmbeddings(
      frame.inbound.media.transcription
    )
  }

  if (frame.outbound?.text && frame.outbound.text.trim()) {
    frame.outbound.textEmbedding = await deps.ai.generateEmbeddings(frame.outbound.text)
  }
}
