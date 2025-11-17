import { tool } from 'ai'
import { z } from 'zod'
import type { ToolExecutionError } from '../errors'
import { spreadError } from '../utils/spreadError'

export interface SendTextContext {
  userWhatsappId: string
  sendText: (text: string) => Promise<unknown>
}

export function createSendTextTool(ctx: SendTextContext) {
  return tool({
    name: 'send_text',
    description: `Send a text message to the user.`,
    inputSchema: z.object({
      text: z.string().describe('The text message to send to the user'),
    }),
    execute: async ({ text }) => {
      try {
        await ctx.sendText(text)

        console.log('send_text: delivered', {
          text,
          textLength: text.length,
        })

        return `Sent message to user: ${text}`
      } catch (error) {
        console.error('Tool execution failed', {
          text,
          ...spreadError(error),
        })
        return {
          error: 'Tool execution failed',
          details: error instanceof Error ? error.message : 'unknown',
        } satisfies ToolExecutionError
      }
    },
  })
}
