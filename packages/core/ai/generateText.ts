import { generateText as aiGenerateText, Output } from 'ai'
import { whatsappResponseSchema } from './schema'

export async function generateText(options: Parameters<typeof aiGenerateText>[0]) {
  return aiGenerateText({
    ...options,
    output: Output.object({
      schema: whatsappResponseSchema,
    }),
  })
}