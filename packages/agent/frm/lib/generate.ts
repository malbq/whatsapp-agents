import { openai } from '@ai-sdk/openai'
import {
  generateWhatsappMessage,
  type GeneratedResponse,
} from '@batman/core/ai/generateWhatsappMessage'
import { stepCountIs, type ModelMessage, type Tool } from 'ai'
import type { FrmDB } from '../db'
import { createSystemPrompt } from '../prompts/system'

const MAX_STEPS = 10

const model = openai.responses('gpt-5-mini-2025-08-07')

export interface GenerateParams {
  messages: ModelMessage[]
  tools: Tool[]
  frmDB: FrmDB
}

export async function generate({
  messages,
  tools,
  frmDB,
}: GenerateParams): Promise<GeneratedResponse> {
  console.log('Generating response with input:', { messages })
  const companyInfo = await frmDB.getCompanyInfo()
  const result = await generateWhatsappMessage({
    model,
    system: createSystemPrompt(companyInfo),
    messages,
    tools: Object.fromEntries(tools.map((tool) => [tool.title, tool])),
    stopWhen: stepCountIs(MAX_STEPS),
    providerOptions: {
      openai: {
        serviceTier: 'flex',
        textVerbosity: 'low',
        reasoningSummary: null,
      },
    },
  })

  return result
}
