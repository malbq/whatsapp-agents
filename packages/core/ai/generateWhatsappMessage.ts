import {
  contactMessageSchema,
  interactiveButtonMessageSchema,
  interactiveListMessageSchema,
  locationMessageSchema,
  textMessageSchema,
} from '@batman/whatsapp'
import {
  generateText as aiGenerateText,
  APICallError,
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

type GenerateOptions<TOOLS extends ToolSet> = Parameters<
  typeof aiGenerateText<TOOLS, Output.Output<GeneratedWhatsappResponse>>
>[0]

type GenerateWaOptions<TOOLS extends ToolSet> = Omit<
  GenerateOptions<TOOLS>,
  'output' | 'experimental_output'
>

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
  system,
  ...options
}: GenerateWaOptions<TOOLS>): Promise<GeneratedResponse> {
  const modelName =
    typeof options.model === 'string'
      ? options.model
      : `${options.model.provider}/${options.model.modelId}`
  console.debug(`Generating WhatsApp message with model ${modelName}`)
  const messages: MessageWithDetails[] = []
  const result = await aiGenerateText<TOOLS, Output.Output<GeneratedWhatsappResponse>>({
    ...options,
    system: `${system ?? ''}\n\n${formattingGuidelines}`.trim(),
    output: Output.object({
      schema: whatsappResponseSchema,
    }),
    prepareStep: ({ stepNumber, steps }) => {
      console.debug(`Preparing step ${stepNumber}`, JSON.stringify(steps, null, 2))
    },
    onStepFinish: (stepResult) => {
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
  } as GenerateOptions<TOOLS>).catch((error) => {
    if (error instanceof APICallError) {
      console.error(
        'Error generating WhatsApp message',
        JSON.stringify(error.requestBodyValues, null, 2)
      )
    }
    throw error
  })
  console.debug(`Generated WhatsApp message with model ${modelName}`)

  return {
    output: result.output.message,
    messages: messages,
  }
}
