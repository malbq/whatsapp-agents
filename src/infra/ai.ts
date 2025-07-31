import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import {
  generateText,
  experimental_transcribe as transcribe,
  type AssistantModelMessage,
  type LanguageModelUsage,
  type SystemModelMessage,
  type TextPart,
  type Tool,
  type UserModelMessage,
} from 'ai'
import chalk from 'chalk'
import { EmbeddingsGenerationError } from '../errors'
import * as Prompt from '../prompts/prompt'
import { formatTokenUsage } from '../utils/formatTokenUsage'

const TEXT_MODEL =
  process.env.TEXT_GENERATION_PROVIDER === 'google'
    ? google('gemini-2.5-flash')
    : openai('gpt-4.1-mini')

const AUDIO_TRANSCRIPTION_MODEL =
  process.env.AUDIO_TRANSCRIPTION_PROVIDER === 'google'
    ? google('gemini-2.5-flash')
    : openai.transcription('whisper-1')

const IMAGE_ANALYSIS_MODEL =
  process.env.IMAGE_ANALYSIS_PROVIDER === 'google'
    ? google('gemini-2.5-flash')
    : openai('gpt-4.1-mini-2025-04-14')

const DOCUMENT_TRANSCRIPTION_MODEL = google('gemini-2.5-flash-lite')
const EMBEDDING_MODEL = '@cf/baai/bge-small-en-v1.5'
const TEXT_GEN_MAX_OUTPUT_TOKENS = 512
const TEXT_GEN_TEMP = 0.1
const TRANSCRIPTION_GEN_TEMP = 0
const UPDATE_USER_PROFILE_TEMP = 0

export type AIMessage = SystemModelMessage | UserModelMessage | AssistantModelMessage

export interface AI {
  respond: (params: { instructions?: string; messages: Array<AIMessage> }) => Promise<string>
  transcribeAudio: (params: { audio: ArrayBuffer }) => Promise<string>
  analyzeImage: (params: {
    instructions?: string
    imageUrl: string
    caption?: string
  }) => Promise<string>
  transcribeDocument: (params: {
    instructions?: string
    document: ArrayBuffer
    mimeType: string
    filename: string
  }) => Promise<string>
  updateUserProfile: (params: { profile: string; message: string }) => Promise<string>
  generateEmbeddings: (params: { text: string[] }) => Promise<number[][]>
}

export const AIProvider: AI = {
  respond: async ({ instructions = Prompt.system, messages }) => {
    let tools: Record<string, Tool> = {}
    switch (TEXT_MODEL.provider) {
      case 'google.generative-ai':
        tools = {
          google_search: google.tools.googleSearch({}),
        }
        break
      case 'openai':
        tools = {
          web_search_preview: openai.tools.webSearchPreview({}),
        }
        break
      default:
    }
    const response = await generateText({
      model: TEXT_MODEL,
      temperature: TEXT_GEN_TEMP,
      system: instructions,
      messages,
      tools,
    })
    console.debug(chalk.gray(`LLM response ${TEXT_MODEL.provider}/${TEXT_MODEL.modelId}`))
    if (
      (response.providerMetadata?.google?.groundingMetadata as any | undefined)?.webSearchQueries
    ) {
      console.debug(
        chalk.gray(
          'google search:',
          (response.providerMetadata?.google?.groundingMetadata as any)?.webSearchQueries
        )
      )
    }
    if (response.toolResults?.length) {
      console.debug(chalk.gray('tools results:', JSON.stringify(response.toolResults)))
    }
    if (response.toolCalls?.length) {
      console.debug(chalk.gray('tools calls:', JSON.stringify(response.toolCalls)))
    }
    console.debug(chalk.gray('usage:', formatTokenUsage(response.usage)))
    console.debug(chalk.gray(response.text))
    return response.text
  },
  transcribeAudio: async ({ audio }) => {
    let text = ''
    let usage: LanguageModelUsage | undefined
    switch (AUDIO_TRANSCRIPTION_MODEL.provider) {
      case 'google.generative-ai':
        {
          const response = await generateText({
            model: AUDIO_TRANSCRIPTION_MODEL as any,
            temperature: TRANSCRIPTION_GEN_TEMP,
            system: 'Generate a transcription of the audio file',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'file',
                    data: audio,
                    mediaType: 'audio/ogg',
                  },
                ],
              },
            ],
          })
          text = response.text
          usage = response.usage
        }
        break
      case 'openai.transcription':
        {
          const response = await transcribe({
            model: AUDIO_TRANSCRIPTION_MODEL as any,
            providerOptions: {
              openai: {
                response_format: 'json',
                temperature: TRANSCRIPTION_GEN_TEMP,
              },
            },
            audio,
          })
          text = response.text
        }
        break
      default:
        throw new Error(`Unsupported provider: ${AUDIO_TRANSCRIPTION_MODEL.provider}`)
    }
    console.debug(
      chalk.gray(
        `LLM transcription ${AUDIO_TRANSCRIPTION_MODEL.provider}/${AUDIO_TRANSCRIPTION_MODEL.modelId}`
      ),
      '\n',
      chalk.gray('usage: ', usage ? formatTokenUsage(usage) : '-'),
      '\n',
      chalk.gray(text)
    )
    return text
  },
  analyzeImage: async ({ instructions = Prompt.analyzeImage, imageUrl, caption }) => {
    const response = await generateText({
      model: IMAGE_ANALYSIS_MODEL,
      maxOutputTokens: TEXT_GEN_MAX_OUTPUT_TOKENS,
      temperature: TEXT_GEN_TEMP,
      system: instructions,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              image: imageUrl,
            },
            ...(caption
              ? [
                  {
                    type: 'text',
                    text: caption,
                  } as TextPart,
                ]
              : []),
          ],
        },
      ],
    })
    console.debug(
      chalk.gray(
        `LLM image analysis ${IMAGE_ANALYSIS_MODEL.provider}/${IMAGE_ANALYSIS_MODEL.modelId}`
      ),
      '\n',
      chalk.gray('usage: ', formatTokenUsage(response.usage)),
      '\n',
      chalk.gray(response.text)
    )
    return response.text
  },
  transcribeDocument: async ({
    instructions = Prompt.trascribeDocument,
    document,
    mimeType,
    filename,
  }) => {
    const response = await generateText({
      model: DOCUMENT_TRANSCRIPTION_MODEL,
      maxOutputTokens: 65536,
      temperature: 0,
      system: instructions,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: document,
              mediaType: mimeType,
              filename,
            },
          ],
        },
      ],
    })
    console.debug(
      chalk.gray(
        `LLM document transcription ${DOCUMENT_TRANSCRIPTION_MODEL.provider}/${DOCUMENT_TRANSCRIPTION_MODEL.modelId}`
      ),
      '\n',
      chalk.gray('usage: ', formatTokenUsage(response.usage)),
      '\n',
      chalk.gray(response.text)
    )
    return response.text
  },
  updateUserProfile: async ({ profile, message }) => {
    const response = await generateText({
      model: TEXT_MODEL,
      maxOutputTokens: 2000,
      temperature: UPDATE_USER_PROFILE_TEMP,
      prompt: Prompt.updateUserProfile(profile, message),
    })
    console.debug(
      chalk.gray(`LLM update user profile ${TEXT_MODEL.provider}/${TEXT_MODEL.modelId}`),
      '\n',
      chalk.gray('usage: ', formatTokenUsage(response.usage)),
      '\n',
      chalk.gray(response.text)
    )
    return response.text
  },
  generateEmbeddings: async ({ text }) => {
    const httpResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${EMBEDDING_MODEL}`,
      {
        headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}` },
        method: 'POST',
        body: JSON.stringify({ text }),
      }
    )

    if (!httpResponse.ok) {
      throw new EmbeddingsGenerationError(
        `Embeddings API request failed: ${httpResponse.status} ${httpResponse.statusText}`
      )
    }

    const response = (await httpResponse.json()) as EmbeddingsResponseBody

    if (!response.success) {
      throw new EmbeddingsGenerationError(
        `Embeddings generation failed: ${response.error.join(', ')}`
      )
    }

    if (!response.result?.data) {
      throw new EmbeddingsGenerationError('Invalid embeddings response: missing result data')
    }

    return response.result.data
  },
}

interface EmbeddingsResponseBody {
  result: {
    shape: number[]
    data: number[][]
    pooling: 'mean' | 'cls'
  }
  success: boolean
  error: string[]
  messages: string[]
}
