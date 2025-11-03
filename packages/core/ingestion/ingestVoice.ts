import type { VoiceMessage } from '@batman/whatsapp'
import { transcribeAudio } from '../ai/transcribeAudio'
import { IngestionError } from '../errors'
import { spreadError } from '../utils/spreadError'

export async function ingestVoice(message: VoiceMessage): Promise<string> {
  try {
    return await transcribeAudio({ audio: message.data })
  } catch (error) {
    console.error('Voice ingestion error', { ...spreadError(error) })
    throw new IngestionError('Failed to transcribe voice message')
  }
}
