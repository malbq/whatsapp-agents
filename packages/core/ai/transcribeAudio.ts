import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { ok } from 'node:assert'

ok(import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY, 'GOOGLE_GENERATIVE_AI_API_KEY is required')

const googleProvider = createGoogleGenerativeAI()
const transcriptionModel = googleProvider('gemini-2.5-flash')
const TRANSCRIPTION_GEN_TEMP = 0

export interface TranscribeAudio {
  (params: { instructions?: string; audio: ArrayBuffer }): Promise<string>
}

const defaultInstructions = 'Transcribe the audio file'

export const transcribeAudio: TranscribeAudio = async ({
  instructions = defaultInstructions,
  audio,
}) => {
  const result = await generateText({
    model: transcriptionModel,
    temperature: TRANSCRIPTION_GEN_TEMP,
    system: instructions,
    messages: [{ role: 'user', content: [{ type: 'file', data: audio, mediaType: 'audio/ogg' }] }],
  })

  console.debug(`Audio transcribed with ${transcriptionModel.modelId}`, {
    gatewayLogId: result.response.headers?.['cf-aig-log-id'],
    totalUsage: result.totalUsage,
    steps: result.steps.map(({ request: _, response: __, ...step }) => {
      return step
    }),
  })
  return result.text
}
