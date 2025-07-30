import { google } from '@ai-sdk/google'
import { openai } from '@ai-sdk/openai'
import {
  generateText,
  experimental_transcribe as transcribe,
  type AssistantModelMessage,
  type SystemModelMessage,
  type TextPart,
  type UserModelMessage,
} from 'ai'
import chalk from 'chalk'
import { EmbeddingsGenerationError } from '../errors'
import imageAnalysisPrompt from '../prompts/imageAnalysis.txt'
import * as Prompt from '../prompts/prompt'

const TEXT_MODEL = 'gpt-4.1-2025-04-14'
const IMAGE_ANALYSIS_MODEL = 'gpt-4.1-mini-2025-04-14'
const AUDIO_TRANSCRIPTION_MODEL = 'whisper-1'
const EMBEDDING_MODEL = '@cf/baai/bge-small-en-v1.5'
const DOCUMENT_TRANSCRIPTION_MODEL = 'gemini-2.5-flash-lite'

export type AIMessage = SystemModelMessage | UserModelMessage | AssistantModelMessage

export interface AI {
  respond: (params: { instructions?: string; messages: Array<AIMessage> }) => Promise<string>
  transcribeAudio: (params: { audio: ArrayBuffer }) => Promise<string>
  analyzeImage: (params: { imageUrl: string; caption?: string }) => Promise<string>
  transcribeDocument: (params: {
    document: ArrayBuffer
    mimeType: string
    filename: string
  }) => Promise<string>
  updateUserProfile: (params: { profile: string; message: string }) => Promise<string>
  generateEmbeddings: (params: { text: string[] }) => Promise<number[][]>
}

export const AIProvider: AI = {
  respond: async ({ instructions, messages }) => {
    const response = await generateText({
      model: openai(TEXT_MODEL),
      maxOutputTokens: 512,
      temperature: 0.1,
      system: instructions,
      messages,
    })
    console.debug(chalk.yellow('LLM response'))
    console.debug(chalk.gray('content', JSON.stringify(response.content)))
    console.debug(chalk.gray('usage', JSON.stringify(response.usage)))
    console.debug(chalk.gray('toolCalls', JSON.stringify(response.toolCalls)))
    console.debug(chalk.gray('toolResults', JSON.stringify(response.toolResults)))
    console.debug(chalk.gray('providerMetadata', JSON.stringify(response.providerMetadata)))
    console.debug(chalk.gray('steps', JSON.stringify(response.steps)))
    console.debug(chalk.gray('warnings', JSON.stringify(response.warnings)))

    return response.text
  },
  transcribeAudio: async ({ audio }) => {
    const response = await transcribe({
      model: openai.transcription(AUDIO_TRANSCRIPTION_MODEL),
      providerOptions: {
        openai: {
          response_format: 'json',
          temperature: 0,
        },
      },
      audio,
    })
    console.debug(chalk.yellow('LLM transcription'))
    console.debug(
      chalk.gray({
        text: JSON.stringify(response.text),
        durationInSeconds: JSON.stringify(response.durationInSeconds),
        providerMetadata: JSON.stringify(response.providerMetadata),
        language: JSON.stringify(response.language),
        segments: JSON.stringify(response.segments),
        warnings: JSON.stringify(response.warnings),
      })
    )
    return response.text
  },
  analyzeImage: async ({ imageUrl, caption }) => {
    const imageInput: UserModelMessage = {
      role: 'user',
      content: [
        {
          type: 'image',
          image: imageUrl,
        },
      ],
    }
    if (caption) {
      ;(imageInput.content as Array<TextPart>).push({
        type: 'text',
        text: caption,
      })
    }
    const response = await generateText({
      model: openai(IMAGE_ANALYSIS_MODEL),
      maxOutputTokens: 500,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: imageAnalysisPrompt,
        },
        imageInput,
      ],
    })
    console.debug(chalk.gray('LLM image analysis:', JSON.stringify(response)))
    return response.text
  },
  transcribeDocument: async ({ document, mimeType, filename }) => {
    const response = await generateText({
      model: google(DOCUMENT_TRANSCRIPTION_MODEL),
      maxOutputTokens: 65536,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: Prompt.trascribeDocument,
        },
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
    console.debug(chalk.yellow('LLM document transcription'))
    console.debug(chalk.gray('usage: ', JSON.stringify(response.usage)))
    console.debug(chalk.gray('text: ', JSON.stringify(response.text)))
    return response.text
  },
  updateUserProfile: async ({ profile, message }) => {
    const response = await generateText({
      model: openai(TEXT_MODEL),
      maxOutputTokens: 2000,
      temperature: 0.1,
      prompt: Prompt.updateUserProfile(profile, message),
    })
    console.debug(chalk.yellow('LLM update user profile'))
    console.debug(chalk.gray('usage: ', JSON.stringify(response.usage)))
    console.debug(chalk.gray('text: ', JSON.stringify(response.text)))
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
