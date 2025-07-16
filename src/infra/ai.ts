import chalk from 'chalk'
import { OpenAI } from 'openai'
import type { Uploadable } from 'openai/uploads.js'
import imageAnalysisPrompt from './prompts/imageAnalysis.txt'

const { TEXT_RESPONSE_MODEL, IMAGE_ANALYSIS_MODEL, AUDIO_TRANSCRIPTION_MODEL } =
  process.env
if (
  !TEXT_RESPONSE_MODEL ||
  !IMAGE_ANALYSIS_MODEL ||
  !AUDIO_TRANSCRIPTION_MODEL
) {
  throw new Error('Missing models in environment variables')
}

const client = new OpenAI()

interface ResponseParams {
  input: string
  instructions?: string
}

type ResponseCreateDefaults = Pick<
  OpenAI.Responses.ResponseCreateParams,
  'model' | 'max_output_tokens' | 'temperature'
>
const TEXT_RESPONSE_DEFAULTS: ResponseCreateDefaults = {
  model: TEXT_RESPONSE_MODEL,
  max_output_tokens: 1000,
  temperature: 0.1,
}
const IMAGE_ANALYSIS_DEFAULTS: ResponseCreateDefaults = {
  model: IMAGE_ANALYSIS_MODEL,
  max_output_tokens: 500,
  temperature: 0.1,
}

type TranscriptionCreateDefault = Pick<
  OpenAI.Audio.Transcriptions.TranscriptionCreateParams,
  'model' | 'language' | 'response_format' | 'temperature'
>
const AUDIO_TRANSCRIPTION_DEFAULTS: TranscriptionCreateDefault = {
  model: AUDIO_TRANSCRIPTION_MODEL,
  language: 'pt',
  response_format: 'json',
  temperature: 0,
}

export namespace AI {
  export async function respond({ input, instructions }: ResponseParams) {
    const response = await client.responses.create({
      ...TEXT_RESPONSE_DEFAULTS,
      instructions,
      input,
    })
    console.debug(chalk.gray('LLM response:', JSON.stringify(response)))
    return response.output_text
  }

  export async function transcribe({ audio }: { audio: Uploadable }) {
    const response = await client.audio.transcriptions.create({
      ...AUDIO_TRANSCRIPTION_DEFAULTS,
      file: audio,
    })
    console.debug(chalk.gray('LLM transcription:', JSON.stringify(response)))
    return response.text
  }

  export async function analyzeImage({
    imageUrl,
    caption,
  }: {
    imageUrl: string
    caption?: string
  }) {
    const imageInput: OpenAI.Responses.ResponseInputItem.Message = {
      role: 'user',
      content: [
        {
          type: 'input_image',
          image_url: imageUrl,
          detail: 'auto',
        },
      ],
    }
    if (caption) {
      imageInput.content.push({
        type: 'input_text',
        text: caption,
      })
    }
    const response = await client.responses.create({
      ...IMAGE_ANALYSIS_DEFAULTS,
      input: [
        {
          role: 'system',
          content: imageAnalysisPrompt,
        },
        imageInput,
      ],
    })
    console.debug(chalk.gray('LLM image analysis:', JSON.stringify(response)))
    return response.output_text
  }
}
