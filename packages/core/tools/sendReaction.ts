import { tool } from 'ai'
import { z } from 'zod'
import type { ToolExecutionError } from '../errors'
import { spreadError } from '../utils/spreadError'

export interface SendReactionContext {
  sendReaction: (emoji: string) => Promise<unknown>
}

export function createSendReactionTool(ctx: SendReactionContext) {
  return tool({
    title: 'send_reaction',
    description:
      'Send a reaction emoji to the user message. Use this for quick acknowledgments and emotional responses.',
    inputSchema: z.object({
      emoji: z.string().describe('The emoji to send as a reaction (e.g., 👍, ❤️, 😊)'),
    }),
    execute: ({ emoji }) =>
      ctx
        .sendReaction(emoji)
        .then(() => {
          console.debug('send_reaction: sent', { emoji })
          return 'Reaction delivered to user'
        })
        .catch((error) => {
          console.error('send_reaction: failed', {
            emoji,
            ...spreadError(error),
          })
          return {
            error: 'Tool execution failed',
            details: error instanceof Error ? error.message : 'unknown',
          } satisfies ToolExecutionError
        }),
  })
}
