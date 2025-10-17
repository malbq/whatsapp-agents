import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { getLogger } from '@logtape/logtape'
import {
  embedMany,
  generateText,
  stepCountIs,
  type AssistantModelMessage,
  type LanguageModelUsage,
  type SystemModelMessage,
  type TextPart,
  type Tool,
  type UserModelMessage,
} from 'ai'

import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { analyzeImage } from '../agent/prompts/analyzeImage'
import { system } from '../agent/prompts/system'
import { transcribeDocument } from '../agent/prompts/transcribeDocument'
import { splitIntoChunks } from '../utils/splitIntoChunks'
import type { ChunkData } from './db'

const logger = getLogger(['infra', 'ai'])

const gatewayBaseURL = `https://gateway.ai.cloudflare.com/v1/${import.meta.env.CF_ACCOUNT_ID}/${
  import.meta.env.CF_GATEWAY_ID
}`

const textProvider = createOpenAICompatible({
  name: 'cf-aig',
  baseURL: `${gatewayBaseURL}/compat`,
  headers: { 'cf-aig-authorization': `Bearer ${import.meta.env.CF_API_TOKEN}` },
})
const textModel = textProvider('openai/gpt-5-mini')

const embeddingProvider = createOpenAICompatible({
  name: 'cf-aig',
  baseURL: `${gatewayBaseURL}/compat`,
  headers: {
    authorization: `Bearer ${import.meta.env.CF_API_TOKEN}`,
    'cf-aig-authorization': `Bearer ${import.meta.env.CF_API_TOKEN}`,
  },
})
const embeddingModel = embeddingProvider.textEmbeddingModel('workers-ai/@cf/baai/bge-m3')

const google = createGoogleGenerativeAI({
  baseURL: `${gatewayBaseURL}/google-ai-studio/v1beta`,
  apiKey: import.meta.env.GOOGLE_AI_STUDIO_API_KEY,
  headers: { 'cf-aig-authorization': `Bearer ${import.meta.env.CF_API_TOKEN}` },
})

const transcriptionModel = google('gemini-2.5-flash')
const imageAnalysisModel = google('gemini-2.5-flash')
const documentTranscriptionModel = google('gemini-2.5-flash-lite')

const IMAGE_ANALYSIS_TEMP = 0.1
const TRANSCRIPTION_GEN_TEMP = 0
const MAX_STEPS = 20

export type AIMessage = SystemModelMessage | UserModelMessage | AssistantModelMessage

export interface AI {
  respond: (params: {
    instructions?: string
    messages: AIMessage[]
    tools?: Tool[]
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
  generateEmbeddings: (text: Array<string>) => Promise<Array<Array<ChunkData>>>
}

export const AIProvider: AI = {
  respond: async ({ instructions = system, messages, tools: customTools = [] }) => {
    const tools: Record<string, Tool> = {}

    customTools.forEach((tool) => {
      tools[(tool as { name: string }).name] = tool
    })

    const result = await generateText({
      model: textModel,
      system: instructions,
      messages,
      tools,
      toolChoice: 'auto',
      stopWhen: stepCountIs(MAX_STEPS),
    })

    logger.debug(`Text generated with ${textModel.modelId}`, {
      gatewayLogId: result.response.headers?.['cf-aig-log-id'],
      totalUsage: result.totalUsage,
      steps: result.steps.map(({ request: _, response: __, ...step }) => {
        return step
      }),
    })

    return {
      text: result.text,
      usage: result.usage,
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

    logger.debug(`Audio transcribed with ${transcriptionModel.modelId}`, {
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
    logger.debug(`Image analyzed with ${imageAnalysisModel.modelId}`, {
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
    logger.debug(`Document transcribed with ${documentTranscriptionModel.modelId}`, {
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

    logger.debug(`Batch embeddings generated with ${embeddingModel.modelId}`, {
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
