import type { Frame } from '../frame'
import type { Deps } from '../types'
import { IngestionError } from '../../../core/errors'
import { spreadError } from '../../../core/utils/spreadError'

//const logger = getLogger(['app', 'agent', 'ingestion', 'audio'])

export async function ingestAudio(frame: Frame, deps: Deps): Promise<void> {
  if (!frame.inbound?.media?.data) throw new IngestionError('Media is required for audio ingestion')

  try {
    frame.inbound.text = await deps.ai.transcribeAudio({ audio: frame.inbound.media.data })
  } catch (error) {
    frame.outboundMessages.push({
      type: frame.inbound.type,
      text: 'Desculpe, tive um problema ao transcrever o áudio.',
    })

    console.error('Audio ingestion error', { ...spreadError(error) })
    throw new IngestionError('Failed to transcribe audio')
  }
}
