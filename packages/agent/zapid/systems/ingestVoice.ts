import type { Frame } from '../frame'
import type { Deps } from '../types'
import { IngestionError } from '../../../core/errors'
import { spreadError } from '../../../core/utils/spreadError'

//const logger = getLogger(['app', 'agent', 'ingestion', 'voice'])

export async function ingestVoice(frame: Frame, deps: Deps): Promise<void> {
  if (!frame.inbound?.media?.data) throw new IngestionError('Media is required for voice ingestion')

  try {
    frame.inbound.text = await deps.ai.transcribeAudio({ audio: frame.inbound.media.data })
  } catch (error) {
    frame.outboundMessages.push({
      type: 'text',
      text: 'Desculpe, tive um problema ao transcrever a mensagem de voz.',
    })

    console.error('Voice ingestion error', { ...spreadError(error) })
    throw new IngestionError('Failed to transcribe voice message')
  }
}
