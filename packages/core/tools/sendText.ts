import { tool } from 'ai'
import { z } from 'zod'

export interface SendTextDeps {
  sendText: (params: { text: string }) => Promise<string>
  onTextSent?: (externalChatId: string, text: string) => void
}

export function createSendTextTool(deps: SendTextDeps) {
  return tool({
    name: 'send_text',
    description: `Send a text message to the user.`,
    inputSchema: z.object({
      text: z.string().describe('The text message to send to the user'),
    }),
    execute: async ({ text }) => {
      const externalChatId = await deps.sendText({ text })

      deps.onTextSent?.(externalChatId, text)

      console.log('send_text: delivered', {
        text,
        textLength: text.length,
        messageId: externalChatId,
      })

      return `Sent message to user: ${text}`
    },
  })
}
