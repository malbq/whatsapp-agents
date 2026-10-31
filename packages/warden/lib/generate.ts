import {
  generateWhatsappMessage,
  type GeneratedResponse,
} from '@wa/core/ai/generateWhatsappMessage'
import { stepCountIs, type LanguageModel, type ModelMessage, type Tool } from 'ai'
import type { WardenDB } from '../db'
import { createSystemPrompt } from '../prompts/system'

const MAX_STEPS = 10

export interface GenerateParams {
  model: LanguageModel
  messages: ModelMessage[]
  tools: Tool[]
  db: WardenDB
}

export async function generate({
  model,
  messages,
  tools,
  db,
}: GenerateParams): Promise<GeneratedResponse> {
  console.log('Generating response with input:', { messages })
  const businessInfo = await db.getBusinessInfo()
  const result = await generateWhatsappMessage({
    model,
    instructions: createSystemPrompt(businessInfo),
    messages,
    tools: Object.fromEntries(tools.map((tool) => [tool.title, tool])),
    stopWhen: stepCountIs(MAX_STEPS),
    providerOptions: {
      openai: {
        serviceTier: 'flex',
        textVerbosity: 'low',
        reasoningSummary: null,
        strictJsonSchema: false,
      },
    },
  })

  return result
}
