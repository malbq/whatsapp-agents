import { getLogger } from '@logtape/logtape'
import { IngestionError } from '../../errors'
import { spreadError } from '../../utils/spreadError'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'ingestion', 'voice'])

export async function ingestVoice(frame: Frame, deps: Deps): Promise<void> {
  if (!frame.inbound?.media?.data) throw new IngestionError('Media is required for voice ingestion')

  try {
    frame.inbound.text = await deps.ai.transcribeAudio({ audio: frame.inbound.media.data })
  } catch (error) {
    frame.outboundMessages.push({
      type: 'text',
      text: 'Desculpe, tive um problema ao transcrever a mensagem de voz.',
    })

    logger.error('Voice ingestion error', { ...spreadError(error) })
    throw new IngestionError('Failed to transcribe voice message')
  }
}
