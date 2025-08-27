import { getLogger } from '@logtape/logtape'
import { IngestionError } from '../../errors'
import * as Prompt from '../../prompts/prompt'
import { spreadError } from '../../utils/spreadError'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'ingestion', 'audio'])

export async function audioIngest(frame: Frame, deps: Deps): Promise<void> {
  if (!frame.inbound?.media?.data) throw new IngestionError('Media is required for audio ingestion')

  try {
    const transcription = await deps.ai.transcribeAudio({ audio: frame.inbound.media.data })
    frame.inbound.audio = { transcription }
    frame.systemMessages.push({
      type: frame.inbound.type,
      text: Prompt.audioTranscription(transcription),
    })
  } catch (error) {
    frame.outbound = {
      type: frame.inbound.type,
      text: 'Desculpe, tive um problema ao transcrever o áudio.',
    }

    logger.error('Audio ingestion error', { ...spreadError(error) })
    throw new IngestionError('Failed to transcribe audio')
  }
}
