import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, type LanguageModelUsage } from 'ai'
import { ok } from 'node:assert'

ok(import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY, 'GOOGLE_GENERATIVE_AI_API_KEY is required')

const googleProvider = createGoogleGenerativeAI()
const transcriptionModel = googleProvider('gemini-2.5-flash')
const TRANSCRIPTION_GEN_TEMP = 0

export interface TranscribeAudioResult {
  text: string
  usage: LanguageModelUsage
}

export interface TranscribeAudio {
  (params: {
    instructions?: string
    audio: ArrayBuffer
    mimeType: string
  }): Promise<TranscribeAudioResult>
}

const defaultInstructions = 'Transcribe the audio file'

export const transcribeAudio: TranscribeAudio = async ({
  instructions = defaultInstructions,
  audio,
  mimeType,
}) => {
  const result = await generateText({
    model: transcriptionModel,
    temperature: TRANSCRIPTION_GEN_TEMP,
    instructions,
    messages: [{ role: 'user', content: [{ type: 'file', data: audio, mediaType: mimeType }] }],
    telemetry: {
      functionId: 'transcribeAudio',
      isEnabled: true,
    },
  })

  console.debug(
    `Audio transcribed with ${transcriptionModel.provider}/${transcriptionModel.modelId}`
  )
  return { text: result.text, usage: result.usage }
}
