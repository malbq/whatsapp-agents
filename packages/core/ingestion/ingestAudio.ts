import type { AudioMessage } from '@batman/whatsapp'
import { transcribeAudio } from '../ai/transcribeAudio'
import { IngestionError } from '../errors'
import { spreadError } from '../utils/spreadError'

export async function ingestAudio(message: AudioMessage): Promise<string> {
  try {
    return await transcribeAudio({ audio: message.data })
  } catch (error) {
    console.error('Audio ingestion error', { ...spreadError(error) })
    throw new IngestionError('Failed to transcribe audio')
  }
}
