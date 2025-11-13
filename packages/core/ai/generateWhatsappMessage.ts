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
  type AssistantModelMessage,
  type LanguageModelUsage,
  type ToolModelMessage,
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
  modelMessage: AssistantModelMessage | ToolModelMessage
  usage?: LanguageModelUsage
}

export interface GenerateResponse {
  output: WhatsappResponseSchema['message']
  messages: EnrichedMessage[]
}

type GenerateOptions<TOOLS extends ToolSet> = Parameters<
  typeof aiGenerateText<TOOLS, Output.Output<WhatsappResponseSchema>>
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
}: GenerateWaOptions<TOOLS>): Promise<GenerateResponse> {
  const result = await aiGenerateText<TOOLS, Output.Output<WhatsappResponseSchema>>({
    ...options,
    system: `${system ?? ''}\n\n${formattingGuidelines}`.trim(),
    output: Output.object({
      schema: whatsappResponseSchema,
    }),
  } as GenerateOptions<TOOLS>)

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
