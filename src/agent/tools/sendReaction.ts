import { getLogger } from '@logtape/logtape'
import { tool } from 'ai'
import { z } from 'zod'
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
        return 'Could not send reaction due to missing user message'
      }
      deps.chat.sendReaction({
        emoji,
        externalChatId: frame.inbound.externalChatId,
      })
      logger.info('send_reaction: sent', {
        emoji,
        messageId: frame.inbound.externalChatId,
      })
      return 'Reaction delivered to user'
    },
  })
