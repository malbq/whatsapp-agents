import { openai } from '@ai-sdk/openai'
import { generateWhatsappMessage } from '@batman/core/ai/generateWhatsappMessage'
import { stepCountIs, type ModelMessage, type Tool } from 'ai'
import { createSystemPrompt } from '../prompts/system'
import { dataStore } from './dataStore'

const MAX_STEPS = 10

const model = openai('gpt-5-mini-2025-08-07')

export interface GenerateParams {
  messages: ModelMessage[]
  tools: Tool[]
}

export async function generate({ messages, tools }: GenerateParams): Promise<{
  text: string
  messages: ModelMessage[]
}> {
  console.log('Generating response with input:', { messages })
  const result = await generateWhatsappMessage({
    model,
    system: createSystemPrompt(dataStore),
    messages,
    tools: Object.fromEntries(tools.map((tool) => [tool.title, tool])),
    stopWhen: stepCountIs(MAX_STEPS),
  })

  return {
    text: result.text,
    messages: result.response.messages,
  }
}
