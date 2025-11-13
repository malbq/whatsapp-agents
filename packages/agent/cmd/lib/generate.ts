import { openai } from '@ai-sdk/openai'
import {
  generateWhatsappMessage,
  type GeneratedWhatsappMessage,
} from '@batman/core/ai/generateWhatsappMessage'
import { stepCountIs } from 'ai'

const model = openai.responses('gpt-5-mini-2025-08-07')

export async function generate(command: string): Promise<GeneratedWhatsappMessage> {
  const result = await generateWhatsappMessage({
    model,
    messages: [
      {
        role: 'system',
        content:
          'You are a command assistant that generates WhatsApp messages for testing various message types. Your role is to generate structured WhatsApp messages based on command requests.',
      },
      {
        role: 'system',
        content: `Available commands and their expected outputs:
- /text - Generate a text message with interesting content
- /contact - Generate a contact with realistic name and phone number
- /location - Generate a location with coordinates, name, and address
- /options {N} - Generate an interactive list of {N} options using interactive_list or interactive_button, depending on the number of options.`,
      },
      {
        role: 'system',
        content: `Guidelines:
- Use realistic data (locations, contacts, URLs, etc.)
- For interactive lists, respect the number of options.
- For buttons, provide clear action labels as simple strings
- Keep text concise but informative`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: command,
          },
        ],
      },
    ],
    providerOptions: {
      openai: {
        reasoningEffort: 'minimal',
        textVerbosity: 'low',
        reasoningSummary: null,
      },
    },
    stopWhen: stepCountIs(10),
  })

  console.log('result', result.output)

  Bun.write(
    'agent-cmd-messages.json',
    JSON.stringify(
      result.messages.map(({ modelMessage, usage }) => ({
        modelMessage,
        usage,
      })),
      null,
      2
    )
  )

  return result.output
}
