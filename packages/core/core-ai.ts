import { createGoogleGenerativeAI } from '@ai-sdk/google'
import {
  customProvider,
  defaultSettingsMiddleware,
  embedMany,
  generateText,
  smoothStream,
  stepCountIs,
  streamText,
  wrapLanguageModel,
  type AssistantModelMessage,
  type SystemModelMessage,
  type TextPart,
  type Tool,
  type UserModelMessage,
} from 'ai'

import { createOpenAI } from '@ai-sdk/openai'
import { analyzeImage } from '../agent/zapid/prompts/analyzeImage'
import { system } from '../agent/zapid/prompts/system'
import { transcribeDocument } from '../agent/zapid/prompts/transcribeDocument'
import type { ChunkData } from './infra/db'
import { createCloudflareCompatibleFetch } from './utils/cloudflareFetch'
import { splitIntoChunks } from './utils/splitIntoChunks'

//const logger = getLogger(['infra', 'ai'])

const accountId = import.meta.env.CF_ACCOUNT_ID

export const cfProvider = createOpenAI({
  baseURL: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`,
  apiKey: import.meta.env.CF_API_TOKEN,
  fetch: createCloudflareCompatibleFetch(fetch),
})

const googleProvider = createGoogleGenerativeAI()

const provider = customProvider({
  languageModels: {
    text: wrapLanguageModel({
      model: cfProvider.responses('@cf/openai/gpt-oss-20b'),
      middleware: defaultSettingsMiddleware({
        settings: {
          toolChoice: { type: 'auto' },
          providerOptions: {
            openai: {
              parallelToolCalls: false,
            },
          },
        },
      }),
    }),
    audioTranscription: googleProvider('gemini-2.5-flash'),
    imageAnalysis: googleProvider('gemini-2.5-flash'),
    documentTranscription: googleProvider('gemini-2.5-flash-lite'),
  },
  textEmbeddingModels: {
    embedding: cfProvider.textEmbeddingModel('workers-ai/@cf/baai/bge-m3'),
  },
})

const textModel = provider.languageModel('text')
const embeddingModel = provider.textEmbeddingModel('embedding')
const transcriptionModel = provider.languageModel('audioTranscription')
const imageAnalysisModel = provider.languageModel('imageAnalysis')
const documentTranscriptionModel = provider.languageModel('documentTranscription')

const IMAGE_ANALYSIS_TEMP = 0.1
const TRANSCRIPTION_GEN_TEMP = 0
const MAX_STEPS = 20

export type AIMessage = SystemModelMessage | UserModelMessage | AssistantModelMessage

export interface AI {
  respond: (params: {
    instructions?: string
    messages: AIMessage[]
    tools?: Tool[]
  }) => Promise<{ stream: AsyncIterable<string> }>
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
  generateEmbeddings: (text: Array<string>) => Promise<Array<Array<ChunkData>>>
}

const chunkingRegex = /<S>/

export const AIProvider: AI = {
  respond: async ({ instructions = system, messages, tools = [] }) => {
    const $tools = Object.fromEntries(tools.map((tool) => [(tool as { name: string }).name, tool]))
    const result = streamText({
      model: textModel,
      system: instructions,
      messages,
      tools: $tools,
      stopWhen: stepCountIs(MAX_STEPS),
      experimental_transform: smoothStream({
        delayInMs: null,
        chunking(buffer) {
          const match = chunkingRegex.exec(buffer)
          if (!match) return null
          return buffer.slice(0, match.index) + match?.[0]
        },
      }),
      onFinish: (result) => {
        console.debug(`Text generated with ${textModel.modelId}`, {
          gatewayLogId: result.response.headers?.['cf-aig-log-id'],
          totalUsage: result.totalUsage,
          steps: result.steps.map(({ request: _, response: __, ...step }) => {
            return step
          }),
        })
      },
    })

    return {
      stream: result.textStream.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            controller.enqueue(chunk.replace(chunkingRegex, '').trim())
          },
        })
      ),
    }
  },

  transcribeAudio: async ({ instructions = 'Transcribe the audio file', audio }) => {
    const result = await generateText({
      model: transcriptionModel,
      temperature: TRANSCRIPTION_GEN_TEMP,
      system: instructions,
      messages: [
        { role: 'user', content: [{ type: 'file', data: audio, mediaType: 'audio/ogg' }] },
      ],
    })

    console.debug(`Audio transcribed with ${transcriptionModel.modelId}`, {
      gatewayLogId: result.response.headers?.['cf-aig-log-id'],
      totalUsage: result.totalUsage,
      steps: result.steps.map(({ request: _, response: __, ...step }) => {
        return step
      }),
    })
    return result.text
  },

  analyzeImage: async ({ instructions = analyzeImage, imageUrl, caption }) => {
    const result = await generateText({
      model: imageAnalysisModel,
      temperature: IMAGE_ANALYSIS_TEMP,
      system: instructions,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', image: imageUrl },
            ...(caption ? [{ type: 'text', text: caption } as TextPart] : []),
          ],
        },
      ],
    })
    console.debug(`Image analyzed with ${imageAnalysisModel.modelId}`, {
      gatewayLogId: result.response.headers?.['cf-aig-log-id'],
      totalUsage: result.totalUsage,
      steps: result.steps.map(({ request: _, response: __, ...step }) => {
        return step
      }),
    })
    return result.text
  },

  transcribeDocument: async ({
    instructions = transcribeDocument,
    document,
    mimeType,
    filename,
  }) => {
    const copy = document.slice(0)
    const result = await generateText({
      model: documentTranscriptionModel,
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
    console.debug(`Document transcribed with ${documentTranscriptionModel.modelId}`, {
      gatewayLogId: result.response.headers?.['cf-aig-log-id'],
      totalUsage: result.totalUsage,
      steps: result.steps.map(({ request: _, response: __, ...step }) => {
        return step
      }),
    })
    return result.text
  },

  generateEmbeddings: async (texts) => {
    const groupedChunks = await Promise.all(
      texts.map(async (text) => {
        if (!text.trim()) {
          return []
        }
        return await splitIntoChunks(text)
      })
    )

    const allChunks = groupedChunks.flat()
    const result = await embedMany({
      model: embeddingModel,
      values: allChunks,
    })

    console.debug(`Batch embeddings generated with ${embeddingModel.modelId}`, {
      textsCount: texts.length,
      totalChunks: allChunks.length,
      embeddings: result.embeddings.map((e) => e.length),
      usage: result.usage,
      providerMetadata: result.providerMetadata,
    })

    let embeddingIndex = 0
    const embeddings = groupedChunks.map<Array<ChunkData>>((textChunks) => {
      const embedding = result.embeddings
        .slice(embeddingIndex, embeddingIndex + textChunks.length)
        .map((embedding, e) => ({
          content: textChunks[e]!,
          embedding,
        }))
      embeddingIndex += textChunks.length
      return embedding
    })

    return embeddings
  },
}
