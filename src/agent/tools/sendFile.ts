import { getLogger } from '@logtape/logtape'
import { tool } from 'ai'
import { z } from 'zod'
import { getMessageTypeFromMimeType } from '../../utils/getMessageTypeFromMimeType'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'tool', 'sendFile'])

export const sendFileToolDefinition = (frame: Frame, deps: Deps) =>
  tool({
    name: 'send_file',
    description:
      'Retrieve a specific file from storage and deliver it to the user. Only use this after searching for files.',
    inputSchema: z.object({
      storageKey: z.string().describe('The storage key of the file to send'),
      caption: z.string().optional().describe('Optional caption (only used for images)'),
    }),
    execute: async ({ storageKey, caption }) => {
      if (!frame.user) return 'Could not send file due to missing user'

      const fileInfo = await deps.storage.retrieve(storageKey)
      const messageType = getMessageTypeFromMimeType(fileInfo.mimeType)

      if (!messageType) {
        return `Unsupported file type: ${fileInfo.mimeType}. Only images and documents are supported`
      }

      if (messageType === 'image') {
        const externalChatId = await deps.chat.sendImage({
          data: fileInfo.data,
          caption,
          mimeType: fileInfo.mimeType,
        })
        frame.outboundFile = {
          externalChatId,
          type: 'image',
          storageKey,
          caption,
        }
        logger.info(`Sent image response to ${frame.user.name} (${frame.user.externalId})`)
        logger.debug(`Image response`, { ...frame.outboundFile })
        return `Image delivered to user`
      }

      const externalChatId = await deps.chat.sendDocument({
        data: fileInfo.data,
        filename: fileInfo.filename,
        caption,
        mimeType: fileInfo.mimeType,
      })
      frame.outboundFile = {
        externalChatId,
        type: 'document',
        storageKey,
        caption,
      }
      logger.info(`Sent document response to ${frame.user.name} (${frame.user.externalId})`)
      logger.debug(`Document response`, { ...frame.outboundFile })
      return `Document delivered to user`
    },
  })
