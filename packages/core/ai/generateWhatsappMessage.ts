import {
  contactMessageSchema,
  interactiveButtonMessageSchema,
  interactiveListMessageSchema,
  locationMessageSchema,
  textMessageSchema,
} from '@batman/whatsapp'
import {
  generateText as aiGenerateText,
  Output,
  type LanguageModelUsage,
  type ModelMessage,
  type ToolSet,
} from 'ai'
import { z } from 'zod'

export const whatsappResponseSchema = z.object({
  message: z.discriminatedUnion('type', [
    textMessageSchema,
    locationMessageSchema,
    contactMessageSchema,
    interactiveButtonMessageSchema,
    interactiveListMessageSchema,
  ]),
})

export type WhatsappResponseSchema = z.infer<typeof whatsappResponseSchema>

export interface EnrichedMessage {
  modelMessage: ModelMessage
  usage?: LanguageModelUsage
}

export interface GenerateResponse {
  output: WhatsappResponseSchema['message']
  messages: EnrichedMessage[]
}

export async function generateWhatsappMessage<TOOLS extends ToolSet>(
  options: Omit<
    Parameters<typeof aiGenerateText<TOOLS, Output.Output<WhatsappResponseSchema>>>[0],
    'output' | 'experimental_output'
  >
): Promise<GenerateResponse> {
  const result = await aiGenerateText<TOOLS, Output.Output<WhatsappResponseSchema>>({
    ...options,
    output: Output.object({
      schema: whatsappResponseSchema,
    }),
  } as Parameters<typeof aiGenerateText<TOOLS, Output.Output<WhatsappResponseSchema>>>[0])

  const messages: EnrichedMessage[] = []

  for (const step of result.steps) {
    if (step.finishReason === 'tool-calls') {
      step.response.messages.slice(-2).forEach((message) => {
        messages.push({
          modelMessage: message,
          usage: message.role === 'assistant' ? step.usage : undefined,
        })
      })
      continue
    }
    const lastMessage = step.response.messages.at(-1)!
    messages.push({
      modelMessage: lastMessage,
      usage: step.usage,
    })
  }

  return {
    output: result.output.message,
    messages,
  }
}
