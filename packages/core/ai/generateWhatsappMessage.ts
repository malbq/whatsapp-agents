import {
  contactMessageSchema,
  interactiveButtonMessageSchema,
  interactiveListMessageSchema,
  locationMessageSchema,
  outgoingDocumentMessageSchema,
  outgoingImageMessageSchema,
  textMessageSchema,
} from '@batman/whatsapp'
import type { Context } from '@ai-sdk/provider-utils'
import {
  generateText as aiGenerateText,
  NoObjectGeneratedError,
  Output,
  type AssistantModelMessage,
  type FinishReason,
  type LanguageModelUsage,
  type ToolModelMessage,
  type ToolSet,
} from 'ai'
import { z } from 'zod'

const whatsappMessageSchema = z.discriminatedUnion('type', [
  textMessageSchema,
  locationMessageSchema,
  contactMessageSchema,
  outgoingDocumentMessageSchema,
  outgoingImageMessageSchema,
  interactiveButtonMessageSchema,
  interactiveListMessageSchema,
])

export type GeneratedWhatsappMessage = z.infer<typeof whatsappMessageSchema>

const whatsappResponseSchema = z.object({
  message: whatsappMessageSchema,
})

export type GeneratedWhatsappResponse = z.infer<typeof whatsappResponseSchema>

export interface MessageWithDetails {
  modelMessage: AssistantModelMessage | ToolModelMessage
  finishReason: FinishReason
  usage?: LanguageModelUsage
}

export interface GeneratedResponse {
  output: GeneratedWhatsappMessage
  messages: MessageWithDetails[]
}

type WhatsappOutput = Output.Output<GeneratedWhatsappResponse>

type GenerateOptions<TOOLS extends ToolSet> = Parameters<
  typeof aiGenerateText<TOOLS, Context, WhatsappOutput>
>[0]

type GenerateWaOptions<TOOLS extends ToolSet> = Omit<
  GenerateOptions<TOOLS>,
  'output' | 'system' | 'instructions' | 'onStepEnd' | 'onStepFinish' | 'telemetry'
> & { instructions?: string }

const formattingGuidelines = `Formatting options for text messages and for interactive messages body:
- Italic: _text_
- Bold: *text*
- Strikethrough: ~text~
- Bulleted list: - text
- Numbered list: 1. text
- Quote: > text
- Monospace block: \`\`\`text\`\`\`
- Inline monospace: \`text\`
Use formatting sparingly.
These are the only formatting options you can use.
Do not format text with anything else, like markdown, XML, or typographic emphasis.`

export async function generateWhatsappMessage<TOOLS extends ToolSet>({
  instructions,
  ...options
}: GenerateWaOptions<TOOLS>): Promise<GeneratedResponse> {
  const messages: MessageWithDetails[] = []

  const result = await aiGenerateText<TOOLS, Context, WhatsappOutput>({
    ...options,
    instructions: `${instructions ?? ''}\n${formattingGuidelines}`.trim(),
    output: Output.object({
      schema: whatsappResponseSchema,
    }),
    onStepEnd: (stepResult) => {
      if (stepResult.response.messages.at(-1)?.role === 'tool') {
        stepResult.response.messages.slice(-2).forEach((message) => {
          messages.push({
            modelMessage: message,
            usage: message.role === 'assistant' ? stepResult.usage : undefined,
            finishReason: stepResult.finishReason,
          })
        })
        return
      }
      messages.push({
        modelMessage: stepResult.response.messages.at(-1)!,
        usage: stepResult.usage,
        finishReason: stepResult.finishReason,
      })
    },
    telemetry: {
      functionId: 'generateWhatsappMessage',
      isEnabled: true,
    },
  } as GenerateOptions<TOOLS>)

  const output = extractOutput(result)

  return {
    output,
    messages,
  }
}

function extractOutput(result: {
  output: GeneratedWhatsappResponse
  text: string
}): GeneratedWhatsappMessage {
  const jsonCodeBlockPrefix = /^json\n/

  try {
    return result.output.message
  } catch (error) {
    if (!NoObjectGeneratedError.isInstance(error) || !jsonCodeBlockPrefix.test(result.text)) {
      throw error
    }

    const jsonText = result.text.replace(jsonCodeBlockPrefix, '')
    const parsed = whatsappResponseSchema.safeParse(JSON.parse(jsonText))

    if (!parsed.success) {
      throw error
    }

    return parsed.data.message
  }
}
