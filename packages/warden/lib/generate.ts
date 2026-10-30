import { openai } from '@ai-sdk/openai'
import {
  generateWhatsappMessage,
  type GeneratedResponse,
} from '@wa/core/ai/generateWhatsappMessage'
import { stepCountIs, type ModelMessage, type Tool } from 'ai'
import type { WardenDB } from '../db'
import { createSystemPrompt } from '../prompts/system'

const MAX_STEPS = 10

const model = openai.responses('gpt-5-mini-2025-08-07')

export interface GenerateParams {
  messages: ModelMessage[]
  tools: Tool[]
  db: WardenDB
}

export async function generate({
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
