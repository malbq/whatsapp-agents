import { openai } from '@ai-sdk/openai'
import {
  generateText,
  experimental_transcribe as transcribe,
  type TextPart,
  type UserModelMessage,
} from 'ai'
import chalk from 'chalk'
import imageAnalysisPrompt from '../prompts/imageAnalysis.txt'

export interface AI {
  respond: (params: { instructions?: string; input: string }) => Promise<string>

  transcribe: (params: { audio: ArrayBuffer }) => Promise<string>

  analyzeImage: (params: {
    imageUrl: string
    caption?: string
  }) => Promise<string>
}

export const AIProvider: AI = {
  respond: async ({ instructions, input }) => {
    const response = await generateText({
      model: openai('gpt-4.1-2025-04-14'),
      system: instructions,
      prompt: input,
      maxOutputTokens: 1000,
      temperature: 0.1,
    })
    console.debug(chalk.gray('LLM response:', JSON.stringify(response)))
    return response.text
  },

  transcribe: async ({ audio }) => {
    const response = await transcribe({
      model: openai.transcription('whisper-1'),
      audio,
      providerOptions: {
        openai: {
          language: 'pt',
          response_format: 'json',
          temperature: 0,
        },
      },
    })
    console.debug(chalk.gray('LLM transcription:', JSON.stringify(response)))
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
      model: openai('gpt-4.1-mini-2025-04-14'),
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
}
