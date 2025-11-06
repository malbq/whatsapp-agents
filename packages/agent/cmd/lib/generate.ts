import { openai } from '@ai-sdk/openai'
import { generateText } from '@batman/core/ai/generateText'
import type { WhatsappResponseSchema } from '@batman/core/ai/schema'
import type { Chat } from '@batman/whatsapp'
import { stepCountIs, tool } from 'ai'
import { z } from 'zod'

const model = openai.responses('gpt-5-mini-2025-08-07')
// const model = openai('gpt-5-nano-2025-08-07')

export async function generate(
  command: string,
  chat: Chat,
  userId: string,
  targetMessageId: string
): Promise<WhatsappResponseSchema> {
  const sendReactionTool = tool({
    description:
      'Send a reaction emoji to the user message. Use random and funny emojis for quick acknowledgments and emotional responses.',
    inputSchema: z.object({
      emoji: z.string().describe('The emoji to send as a reaction (e.g., 👍, ❤️, 😊)'),
    }),
    execute: async ({ emoji }) => {
      chat.sendReaction(userId, {
        emoji,
        targetMessageId,
      })
    },
  })

  const result = await generateText({
    model,
    system,
    prompt: command,
    tools: {
      send_reaction: sendReactionTool,
    },
    providerOptions: {
      openai: {
        reasoningEffort: 'low',
        textVerbosity: 'low',
      },
    },
    stopWhen: stepCountIs(10),
  })

  console.log('result', JSON.stringify(result.output.message, null, 2))

  return result.output.message
}

const system = `You are a command assistant that generates WhatsApp messages for testing various message types.
Your role is to generate structured WhatsApp messages based on command requests.

Available commands and their expected outputs:
- /text - Generate a text message with interesting content
- /contact - Generate a contact with realistic name and phone number
- /location - Generate a location with coordinates, name, and address
- /options {N} - Generate an interactive list of {N} options

Guidelines:
- Always react to user messages with a random and funny emoji using the send_reaction tool before generating the message response.
- Use realistic data (locations, contacts, URLs, etc.)
- For interactive lists, respect the number of options.
- For buttons, provide clear action labels as simple strings
- Keep text concise but informative`
