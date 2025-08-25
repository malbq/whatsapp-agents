import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import { getLogger } from '@logtape/logtape'
import {
  generateText,
  stepCountIs,
  tool,
  experimental_transcribe as transcribe,
  type AssistantModelMessage,
  type LanguageModelUsage,
  type SystemModelMessage,
  type TextPart,
  type Tool,
  type UserModelMessage,
} from 'ai'
import { z } from 'zod'
import { getContext } from '..'
import { EmbeddingsGenerationError } from '../errors'
import * as Prompt from '../prompts/prompt'
import { formatTokenUsage } from '../utils/formatTokenUsage'
import type { DB, FileSearchResult } from './db'

const logger = getLogger(['app', 'infra', 'ai'])

const TEXT_MODEL =
  import.meta.env.TEXT_GENERATION_PROVIDER === 'google'
    ? google('gemini-2.5-flash')
    : openai('gpt-4.1-mini')

const AUDIO_TRANSCRIPTION_MODEL =
  import.meta.env.AUDIO_TRANSCRIPTION_PROVIDER === 'google'
    ? google('gemini-2.5-flash')
    : openai.transcription('whisper-1')

const IMAGE_ANALYSIS_MODEL =
  import.meta.env.IMAGE_ANALYSIS_PROVIDER === 'google'
    ? google('gemini-2.5-flash')
    : openai('gpt-4.1-mini-2025-04-14')

const DOCUMENT_TRANSCRIPTION_MODEL = google('gemini-2.5-flash-lite')
const EMBEDDING_MODEL = '@cf/baai/bge-small-en-v1.5'
const TEXT_GEN_MAX_OUTPUT_TOKENS = 512
const TEXT_GEN_TEMP = 0.1
const TRANSCRIPTION_GEN_TEMP = 0
const UPDATE_USER_PROFILE_TEMP = 0
const MAX_STEPS = 5

export type AIMessage = SystemModelMessage | UserModelMessage | AssistantModelMessage

export interface AI {
  respond: (params: {
    instructions?: string
    messages: Array<AIMessage>
    userMessageEmbedding?: number[]
  }) => Promise<{
    text: string
    usage: LanguageModelUsage
    storageKey?: string
  }>
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
  improveUserProfile: (params: { profile: string; message: string }) => Promise<string>
  generateEmbeddings: (params: { text: string[] }) => Promise<number[][]>
}

export const AIProvider: (db: DB) => AI = (db) => {
  const searchFilesTool = (embedding: number[]) =>
    tool({
      description:
        'Search for files based on content similarity. Use this when the user asks about documents, files, or specific information that might be stored in uploaded files.',
      inputSchema: z.object({}),
      execute: async () => {
        const userId = getContext().get('userId')
        if (!userId) {
          throw new Error('User ID required for file search')
        }

        const results = await db.searchFiles({
          userId,
          queryEmbedding: embedding,
        })

        return results.map<Omit<FileSearchResult, 'messageId'>>((file) => ({
          storageKey: file.storageKey,
          timestamp: file.timestamp,
          snippet: file.snippet,
          score: file.score,
        }))
      },
    })

  const retrieveFileTool = tool({
    description:
      'Retrieve a specific file using its storage key, to be sent to user. Only use this after searching for files.',
    inputSchema: z.object({
      storageKey: z.string().describe('The storage key of the file to retrieve'),
    }),
    execute: async ({ storageKey }) => {
      const userId = getContext().get('userId')
      if (!userId) {
        throw new Error('User ID required for file retrieval')
      }

      return `File with storage key ${storageKey} has been queued for retrieval and will be sent to you shortly.`
    },
  })
  return {
    respond: async ({ instructions = Prompt.system, messages, userMessageEmbedding }) => {
      const ctxLogger = logger.with({
        provider: TEXT_MODEL.provider,
        model: TEXT_MODEL.modelId,
        system: instructions,
        prompt: messages.map((m) => `${m.role}: ${m.content}`).join('\n'),
      })

      let tools: Record<string, Tool> = {}
      if (userMessageEmbedding) {
        tools.search_files = searchFilesTool(userMessageEmbedding)
        tools.retrieve_file = retrieveFileTool
      }
      switch (TEXT_MODEL.provider) {
        case 'google.generative-ai':
          tools.google_search = google.tools.googleSearch({})
          break
        case 'openai':
          tools.web_search_preview = openai.tools.webSearchPreview({})
          break
        default:
      }

      const response = await generateText({
        model: TEXT_MODEL,
        temperature: TEXT_GEN_TEMP,
        system: instructions,
        messages,
        tools,
        stopWhen: stepCountIs(MAX_STEPS),
        maxOutputTokens: TEXT_GEN_MAX_OUTPUT_TOKENS,
      })

      ctxLogger.debug('Text generation {provider}/{model}', {
        text: response.text,
        usage: formatTokenUsage(response.usage),
        stepsCount: response.steps?.length || 0,
        ...(response.steps?.length > 1 ? { steps: response.steps } : {}),
      })

      if (
        (response.providerMetadata?.google?.groundingMetadata as any | undefined)?.webSearchQueries
      ) {
        ctxLogger.debug(
          'Google search {*}',
          (response.providerMetadata?.google?.groundingMetadata as any)?.webSearchQueries
        )
      }

      if (response.toolCalls?.length) {
        ctxLogger.debug('Tools calls {provider}/{model}', { toolCalls: response.toolCalls })
      }

      if (response.toolResults?.length) {
        ctxLogger.debug('Tools results {provider}/{model}', { toolResults: response.toolResults })
      }

      const storageKey = response.toolResults.find((result) => result.toolName === 'retrieve_file')
        ?.output.storageKey as string | undefined

      return {
        text: response.text,
        usage: response.usage,
        storageKey,
      }
    },
    transcribeAudio: async ({ audio }: { audio: ArrayBuffer }) => {
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
      logger.debug('Audio transcription {provider}/{model}', {
        provider: AUDIO_TRANSCRIPTION_MODEL.provider,
        model: AUDIO_TRANSCRIPTION_MODEL.modelId,
        text,
        usage: formatTokenUsage(usage),
      })
      return text
    },
    analyzeImage: async ({
      instructions = Prompt.analyzeImage,
      imageUrl,
      caption,
    }: {
      instructions?: string
      imageUrl: string
      caption?: string
    }) => {
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
      logger.debug('Image analysis {provider}/{model}', {
        provider: IMAGE_ANALYSIS_MODEL.provider,
        model: IMAGE_ANALYSIS_MODEL.modelId,
        text: response.text,
        usage: formatTokenUsage(response.usage),
      })
      return response.text
    },
    transcribeDocument: async ({
      instructions = Prompt.trascribeDocument,
      document,
      mimeType,
      filename,
    }: {
      instructions?: string
      document: ArrayBuffer
      mimeType: string
      filename: string
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
      logger.debug('Document transcription {provider}/{model}', {
        provider: DOCUMENT_TRANSCRIPTION_MODEL.provider,
        model: DOCUMENT_TRANSCRIPTION_MODEL.modelId,
        text: response.text,
        usage: formatTokenUsage(response.usage),
      })
      return response.text
    },
    improveUserProfile: async ({ profile, message }: { profile: string; message: string }) => {
      const response = await generateText({
        model: TEXT_MODEL,
        maxOutputTokens: 2000,
        temperature: UPDATE_USER_PROFILE_TEMP,
        prompt: Prompt.updateUserProfile(profile, message),
      })
      logger.debug('Update user profile {provider}/{model}', {
        provider: TEXT_MODEL.provider,
        model: TEXT_MODEL.modelId,
        text: response.text,
        usage: formatTokenUsage(response.usage),
      })
      return response.text
    },
    generateEmbeddings: async ({ text }: { text: string[] }) => {
      const httpResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${
          import.meta.env.CF_ACCOUNT_ID
        }/ai/run/${EMBEDDING_MODEL}`,
        {
          headers: { Authorization: `Bearer ${import.meta.env.CF_API_TOKEN}` },
          method: 'POST',
          body: JSON.stringify({ text }),
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

      logger.debug('Embeddings generation {model}', {
        model: EMBEDDING_MODEL,
        shape: response.result.shape,
        pooling: response.result.pooling,
      })
      return response.result.data
    },
  }
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
