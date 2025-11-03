import { tool } from 'ai'
import { z } from 'zod'
import type { ToolExecutionError } from '../errors'
import { spreadError } from '../utils/spreadError'

export interface SendReactionDeps {
  inboundMessageId?: string
  sendReaction: (params: { emoji: string; externalChatId: string }) => Promise<void> | void
}

export function createSendReactionTool(deps: SendReactionDeps) {
  return tool({
    name: 'send_reaction',
    description:
      'Send a reaction emoji to the user message. Use this for quick acknowledgments and emotional responses.',
    inputSchema: z.object({
      emoji: z.string().describe('The emoji to send as a reaction (e.g., 👍, ❤️, 😊)'),
    }),
    execute: async ({ emoji }) => {
      if (!deps.inboundMessageId) {
        console.error('send_reaction: missing inbound message', { emoji })
        return {
          error: 'Missing inbound message',
          details: 'Could not send reaction due to missing user message',
        } satisfies ToolExecutionError
      }
      try {
        deps.sendReaction({
          emoji,
          externalChatId: deps.inboundMessageId,
        })
        console.log('send_reaction: sent', {
          emoji,
          messageId: deps.inboundMessageId,
        })
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
