import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import { getLogger } from '@logtape/logtape'
import {
  generateText,
  stepCountIs,
  experimental_transcribe as transcribe,
  type AssistantModelMessage,
  type LanguageModel,
  type LanguageModelUsage,
  type SystemModelMessage,
  type TextPart,
  type TranscriptionModel,
  type UserModelMessage,
} from 'ai'

import { analyzeImage } from '../agent/prompts/analyzeImage'
import { system } from '../agent/prompts/system'
import { transcribeDocument } from '../agent/prompts/transcribeDocument'
import { EmbeddingsGenerationError } from '../errors'
import { formatTokenUsage } from '../utils/formatTokenUsage'
import { splitIntoChunks } from '../utils/splitIntoChunks'
import type { ChunkData } from './db'

const logger = getLogger(['infra', 'ai'])

const TEXT_MODEL =
  import.meta.env.TEXT_GENERATION_PROVIDER === 'google'
    ? google('gemini-2.5-flash')
    : openai('gpt-5-mini')

const AUDIO_TRANSCRIPTION_MODEL =
  import.meta.env.AUDIO_TRANSCRIPTION_PROVIDER === 'google'
    ? google('gemini-2.5-flash')
    : openai.transcription('whisper-1')

const IMAGE_ANALYSIS_MODEL =
  import.meta.env.IMAGE_ANALYSIS_PROVIDER === 'google'
    ? google('gemini-2.5-flash')
    : openai('gpt-4.1-mini-2025-04-14')

const DOCUMENT_TRANSCRIPTION_MODEL = google('gemini-2.5-flash-lite')
const EMBEDDING_MODEL = '@cf/baai/bge-m3'
const IMAGE_ANALYSIS_TEMP = 0.1
const TRANSCRIPTION_GEN_TEMP = 0
const MAX_STEPS = 6

export type AIMessage = SystemModelMessage | UserModelMessage | AssistantModelMessage

export interface AI {
  respond: (params: {
    instructions?: string
    messages: AIMessage[]
  }) => Promise<{ text: string; usage: LanguageModelUsage }>
  transcribeAudio: (params: { instructions?: string; audio: ArrayBuffer }) => Promise<string>
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
  generateEmbeddings: (text: string) => Promise<Array<ChunkData>>
}

type AiToolSet = {
  google_search?: ReturnType<typeof google.tools.googleSearch>
  web_search_preview?: ReturnType<typeof openai.tools.webSearchPreview>
}

export const AIProvider: AI = {
  respond: async ({ instructions = system, messages }) => {
    let tools: AiToolSet = {}
    switch (TEXT_MODEL.provider) {
      case 'google.generative-ai':
        tools.google_search = google.tools.googleSearch({})
        break
      case 'openai':
        tools.web_search_preview = openai.tools.webSearchPreview({})
        break
      default:
    }

    const result = await generateText<AiToolSet>({
      model: TEXT_MODEL,
      system: instructions,
      messages,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
    })
    const toolResults = result.steps?.flatMap((step) => step.toolResults) ?? []

    const ctxLogger = logger.with({
      responseId: result.response.id,
    })
    ctxLogger.debug(`Text generated from ${TEXT_MODEL.provider}/${TEXT_MODEL.modelId}`, {
      usage: formatTokenUsage(result.usage),
      tools: (result.request.body as any).tools,
      stepsCount: result.steps?.length || 0,
      input: (result.request.body as any)?.input,
      output: result.content,
      toolResults,
    })

    if ((result.providerMetadata?.google?.groundingMetadata as any | undefined)?.webSearchQueries) {
      ctxLogger.debug(
        'Google search {*}',
        (result.providerMetadata?.google?.groundingMetadata as any)?.webSearchQueries
      )
    }

    return {
      text: result.text,
      usage: result.usage,
    }
  },

  transcribeAudio: async ({ instructions = 'Transcribe the audio file', audio }) => {
    let text = ''
    let usage: LanguageModelUsage | undefined
    switch (AUDIO_TRANSCRIPTION_MODEL.provider) {
      case 'google.generative-ai':
        {
          const response = await generateText({
            model: AUDIO_TRANSCRIPTION_MODEL as LanguageModel,
            temperature: TRANSCRIPTION_GEN_TEMP,
            system: instructions,
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
            model: AUDIO_TRANSCRIPTION_MODEL as TranscriptionModel,
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
    logger.debug(
      `Audio transcription from ${AUDIO_TRANSCRIPTION_MODEL.provider}/${AUDIO_TRANSCRIPTION_MODEL.modelId}`,
      {
        text,
        usage: formatTokenUsage(usage),
      }
    )
    return text
  },

  analyzeImage: async ({ instructions = analyzeImage, imageUrl, caption }) => {
    const response = await generateText({
      model: IMAGE_ANALYSIS_MODEL,
      temperature: IMAGE_ANALYSIS_TEMP,
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
    logger.debug(
      `Image analysis from ${IMAGE_ANALYSIS_MODEL.provider}/${IMAGE_ANALYSIS_MODEL.modelId}`,
      {
        text: response.text,
        usage: formatTokenUsage(response.usage),
      }
    )
    return response.text
  },

  transcribeDocument: async ({
    instructions = transcribeDocument,
    document,
    mimeType,
    filename,
  }) => {
    const copy = document.slice(0)
    const response = await generateText({
      model: DOCUMENT_TRANSCRIPTION_MODEL,
      temperature: 0,
      system: instructions,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'file',
              data: copy,
              mediaType: mimeType,
              filename,
            },
          ],
        },
      ],
    })
    logger.debug(
      `Document transcription ${DOCUMENT_TRANSCRIPTION_MODEL.provider}/${DOCUMENT_TRANSCRIPTION_MODEL.modelId}`,
      {
        text: response.text,
        usage: formatTokenUsage(response.usage),
      }
    )
    return response.text
  },

  generateEmbeddings: async (text) => {
    const chunks = await splitIntoChunks(text)
    const httpResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${
        import.meta.env.CF_ACCOUNT_ID
      }/ai/run/${EMBEDDING_MODEL}`,
      {
        headers: { Authorization: `Bearer ${import.meta.env.CF_API_TOKEN}` },
        method: 'POST',
        body: JSON.stringify({ text: chunks }),
      }
    )

    if (!httpResponse.ok) {
      throw new EmbeddingsGenerationError(
        `Embeddings API request failedn${JSON.stringify({
          status: httpResponse.status,
          statusText: httpResponse.statusText,
          body: await httpResponse.text(),
        })}`
      )
    }

    const response = (await httpResponse.json()) as EmbeddingsResponseBody

    if (!response.success) {
      throw new EmbeddingsGenerationError(
        `Embeddings generation failed\n${response.error.join(', ')}`
      )
    }

    if (!response.result?.data) {
      throw new EmbeddingsGenerationError('Invalid embeddings response\nmissing result data')
    }

    logger.debug(`Embeddings generated with ${EMBEDDING_MODEL}`, {
      input: text,
      shape: response.result.shape,
      pooling: response.result.pooling,
    })
    return response.result.data.map<ChunkData>((embedding, i) => ({
      content: chunks[i]!,
      embedding,
    }))
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
