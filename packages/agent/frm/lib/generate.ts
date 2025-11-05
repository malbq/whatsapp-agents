import { openai } from '@ai-sdk/openai'
import { generateText, stepCountIs, type ModelMessage, type Tool } from 'ai'
import { createSystemPrompt } from '../prompts/system'
import { dataStore } from './dataStore'

const MAX_STEPS = 10

const model = openai('gpt-5-mini-2025-08-07')

export interface GenerateParams {
  messages: ModelMessage[]
  tools: Tool[]
}

export async function generate({ messages, tools }: GenerateParams): Promise<string> {
  console.log('Generating response with input:', { messages })
  const result = await generateText({
    model,
    system: createSystemPrompt(dataStore),
    messages,
    tools: Object.fromEntries(
      tools.map((tool) => [(tool as unknown as { name: string }).name, tool])
    ),
    stopWhen: stepCountIs(MAX_STEPS),
  })

  return result.text
}
