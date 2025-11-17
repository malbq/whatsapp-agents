import { tool } from 'ai'
import { z } from 'zod'
import type { ToolExecutionError } from '../errors'
import { spreadError } from '../utils/spreadError'

export interface SendReactionContext {
  sendReaction: (emoji: string) => Promise<unknown>
}

export function createSendReactionTool(ctx: SendReactionContext) {
  return tool({
    name: 'send_reaction',
    description:
      'Send a reaction emoji to the user message. Use this for quick acknowledgments and emotional responses.',
    inputSchema: z.object({
      emoji: z.string().describe('The emoji to send as a reaction (e.g., 👍, ❤️, 😊)'),
    }),
    execute: async ({ emoji }) => {
      try {
        ctx.sendReaction(emoji)
        console.log('send_reaction: sent', { emoji })
        return 'Reaction delivered to user'
      } catch (error) {
        console.error('Tool execution failed', {
          emoji,
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
