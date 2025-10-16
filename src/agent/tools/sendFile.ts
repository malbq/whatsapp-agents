import { getLogger } from '@logtape/logtape'
import { tool } from 'ai'
import { z } from 'zod'
import { getMessageTypeFromMimeType } from '../../utils/getMessageTypeFromMimeType'
import type { Frame, FrameOutboundMessage } from '../frame'

const logger = getLogger(['app', 'agent', 'tool', 'sendFile'])

export const sendFileTool = (frame: Frame, deps: Deps) =>
  tool({
    name: 'send_file',
    description:
      'Retrieve a specific file from storage and deliver it to the user. Only call this after using search_files tool. Only pass a messageId returned in the last search_files results. Do not pass filenames.',
    inputSchema: z.object({
      messageId: z.string().describe('The message ID of the file to send from search results'),
      caption: z.string().optional().describe('Optional caption (only used for images)'),
    }),
    execute: async ({ messageId, caption }) => {
      if (!frame.user) {
        logger.error('Could not send file due to missing user')
        return 'Could not send file due to missing user'
      }

      if (!frame.lastSearchFiles?.some((result) => result.messageId === messageId)) {
        logger.error(
          `Invalid send_file attempt: messageId ${messageId} not found in last search results`,
          { messageId, lastSearchFiles: frame.lastSearchFiles }
        )
        return 'Please run search_files first and select a file from the results.'
      }

      const message = await deps.db.findStorageKeyById({ userId: frame.user.id, messageId })
      if (!message) {
        logger.error(`Message not found: ${messageId}`)
        return 'File not found. Please run search_files again.'
      }

      const fileInfo = await deps.storage.retrieve(message.storageKey)
      const messageType = getMessageTypeFromMimeType(fileInfo.mimeType)

      if (!messageType) {
        logger.error(`Unsupported file type: ${fileInfo.mimeType}`)
        return `Unsupported file type: ${fileInfo.mimeType}. Only images and documents are supported`
      }

      if (messageType === 'image') {
        const externalChatId = await deps.chat.sendImage({
          data: fileInfo.data,
          caption,
          mimeType: fileInfo.mimeType,
        })
        const outboundImage: FrameOutboundMessage = {
          externalChatId,
          type: 'image',
          storageKey: message.storageKey,
          text: caption ?? '',
        }
        frame.outboundMessages.push(outboundImage)
        logger.debug('Sent image message', { ...outboundImage })
        return 'Image delivered to user'
      }

      const externalChatId = await deps.chat.sendDocument({
        data: fileInfo.data,
        filename: fileInfo.filename,
        caption,
        mimeType: fileInfo.mimeType,
      })
      const outboundDocument: FrameOutboundMessage = {
        externalChatId,
        type: 'document',
        storageKey: message.storageKey,
        text: caption ?? '',
      }
      frame.outboundMessages.push(outboundDocument)
      logger.debug('Sent document message', { ...outboundDocument })
      return 'Document delivered to user'
    },
  })
