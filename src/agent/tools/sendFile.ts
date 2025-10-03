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
      'Retrieve a specific file from storage and deliver it to the user. Only call this after using search_files tool. Only pass a messageId returned in the last search_files results. Do not pass filenames.',
    inputSchema: z.object({
      messageId: z.string().describe('The message ID of the file to send from search results'),
      caption: z.string().optional().describe('Optional caption (only used for images)'),
    }),
    execute: async ({ messageId, caption }) => {
      if (!frame.user) return 'Could not send file due to missing user'

      if (!frame.lastSearchFiles?.some((result) => result.messageId === messageId)) {
        logger.warn(
          `Invalid send_file attempt: messageId ${messageId} not found in last search results`,
          { messageId, lastSearchFiles: frame.lastSearchFiles }
        )
        return 'Please run search_files first and select a file from the results.'
      }

      const message = await deps.db.findStorageKeyById({ userId: frame.user.id, messageId })
      if (!message) {
        logger.warn(`Message not found: ${messageId}`)
        return 'File not found. Please run search_files again.'
      }

      const fileInfo = await deps.storage.retrieve(message.storageKey)
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
          storageKey: message.storageKey,
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
        storageKey: message.storageKey,
        caption,
      }
      logger.info(`Sent document response to ${frame.user.name} (${frame.user.externalId})`)
      logger.debug(`Document response`, { ...frame.outboundFile })
      return `Document delivered to user`
    },
  })
