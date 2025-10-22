import { getLogger } from '@logtape/logtape'
import { tool } from 'ai'
import { z } from 'zod'
import type { ToolExecutionError } from '../../errors'
import { spreadError } from '../../utils/spreadError'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'tool', 'sendReaction'])

export const sendReactionTool = (frame: Frame, deps: Deps) =>
  tool({
    name: 'send_reaction',
    description:
      'Send a reaction emoji to the user message. Use this for quick acknowledgments and emotional responses.',
    inputSchema: z.object({
      emoji: z.string().describe('The emoji to send as a reaction (e.g., 👍, ❤️, 😊)'),
    }),
    execute: async ({ emoji }) => {
      if (!frame.inbound?.externalChatId) {
        logger.error('send_reaction: missing inbound message', { emoji })
        return {
          error: 'Missing inbound message',
          details: 'Could not send reaction due to missing user message',
        } satisfies ToolExecutionError
      }
      try {
        deps.chat.sendReaction({
          emoji,
          externalChatId: frame.inbound.externalChatId,
        })
        logger.info('send_reaction: sent', {
          emoji,
          messageId: frame.inbound.externalChatId,
        })
        return 'Reaction delivered to user'
      } catch (error) {
        logger.error('Tool execution failed', {
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
