import { generateText, type LanguageModel, type LanguageModelUsage } from 'ai'

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

export const createTranscribeAudio =
  ({ model }: { model: LanguageModel }): TranscribeAudio =>
  async ({ instructions = defaultInstructions, audio, mimeType }) => {
    const result = await generateText({
      model,
      temperature: TRANSCRIPTION_GEN_TEMP,
      instructions,
      messages: [{ role: 'user', content: [{ type: 'file', data: audio, mediaType: mimeType }] }],
      telemetry: {
        functionId: 'transcribeAudio',
        isEnabled: true,
      },
    })

    console.debug(`Audio transcribed with ${result.response.modelId}`)
    return { text: result.text, usage: result.usage }
  }
