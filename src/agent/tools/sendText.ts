import { getLogger } from '@logtape/logtape'
import { tool } from 'ai'
import { z } from 'zod'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'tool', 'sendText'])

export const sendTextTool = (frame: Frame, deps: Deps) =>
  tool({
    name: 'sendText',
    description: `Send a text message to the user.`,
    inputSchema: z.object({
      text: z.string().describe('The text message to send to the user'),
    }),
    execute: async ({ text }) => {
      if (!frame.user) {
        logger.error('Could not send text due to missing user')
        return 'Could not send text due to missing user'
      }

      const externalChatId = await deps.chat.sendText({ text })

      frame.outboundMessages.push({
        externalChatId,
        type: 'text',
        text,
      })

      logger.debug('Sent text message', {
        message: text,
        messageLength: text.length,
        messageId: externalChatId,
      })

      return 'Message sent successfully'
    },
  })
