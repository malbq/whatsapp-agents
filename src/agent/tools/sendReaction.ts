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
      if (!frame.inbound?.externalChatId)
        return 'Could not send reaction due to missing user message'
      deps.chat.sendReaction({
        emoji,
        externalChatId: frame.inbound.externalChatId,
      })
      logger.debug(
        `Sent reaction ${emoji} to message ${frame.inbound.externalChatId} from ${
          frame.user!.name
        } (${frame.user!.externalId})`
      )
      return 'Reaction delivered to user'
    },
  })
