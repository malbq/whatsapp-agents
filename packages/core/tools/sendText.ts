import type { Chat } from '@batman/whatsapp'
import { tool } from 'ai'
import { z } from 'zod'

export interface SendTextContext {
  userWhatsappId: string
  sendText: Chat['sendText']
}

export function createSendTextTool(ctx: SendTextContext) {
  return tool({
    name: 'send_text',
    description: `Send a text message to the user.`,
    inputSchema: z.object({
      text: z.string().describe('The text message to send to the user'),
    }),
    execute: async ({ text }) => {
      const externalChatId = await ctx.sendText(ctx.userWhatsappId, { text })

      console.log('send_text: delivered', {
        text,
        textLength: text.length,
        messageId: externalChatId,
      })

      return `Sent message to user: ${text}`
    },
  })
}
