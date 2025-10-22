import { getLogger } from '@logtape/logtape'
import { tool } from 'ai'
import { z } from 'zod'
import type { ToolExecutionError } from '../../errors'
import { getMessageTypeFromMimeType } from '../../utils/getMessageTypeFromMimeType'
import { spreadError } from '../../utils/spreadError'
import type { Frame, FrameOutboundMessage } from '../frame'
import { toolUsageExplanation } from '../prompts/toolUsageExplanation'

const logger = getLogger(['app', 'agent', 'tool', 'sendFile'])

export const sendFileTool = (frame: Frame, deps: Deps) =>
  tool({
    name: 'send_file',
    description: `Retrieve a specific file from storage and deliver it to the user.
Only call this after using \`search_files\` tool.
Only pass a messageId returned in the last \`search_files\` results.
Do not pass filenames.`,
    inputSchema: z.object({
      messageId: z
        .string()
        .describe('The message ID associated with the file to send from `search_files` results'),
      caption: z.string().optional().describe('Optional caption (only used for images)'),
      explanation: z.string().describe(toolUsageExplanation),
    }),
    execute: async (params) => {
      try {
        const { messageId, caption, explanation } = params

        if (!frame.user) {
          logger.error('missing user', params)
          return 'Could not send file due to missing user'
        }

        const explanationChatId = await deps.chat.sendText({ text: explanation })
        frame.outboundMessages.push({
          externalChatId: explanationChatId,
          type: 'text',
          text: explanation,
        })

        if (!frame.lastSearchFiles?.some((result) => result.messageId === messageId)) {
          logger.error('messageId not found in last search results', {
            ...params,
            lastSearchFiles: frame.lastSearchFiles,
          })
          return 'Please run search_files first and select a file from the results.'
        }

        const message = await deps.db.findStorageKeyById({ userId: frame.user.id, messageId })
        if (!message) {
          logger.error('message not found in storage', {
            ...params,
            userId: frame.user.id,
          })
          return 'File not found. Please run search_files again.'
        }

        const fileInfo = await deps.storage.retrieve(message.storageKey)
        const messageType = getMessageTypeFromMimeType(fileInfo.mimeType)

        if (!messageType) {
          logger.error('unsupported file type', {
            ...params,
            mimeType: fileInfo.mimeType,
            storageKey: message.storageKey,
          })
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
          logger.info('image delivered', {
            ...params,
            mimeType: fileInfo.mimeType,
            captionLength: caption?.length ?? 0,
          })
          logger.debug('sent image message', { ...params, ...outboundImage })
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
        logger.info('document delivered', {
          ...params,
          filename: fileInfo.filename,
          mimeType: fileInfo.mimeType,
          captionLength: caption?.length ?? 0,
        })
        logger.debug('sent document message', { ...params, ...outboundDocument })
        return 'Document delivered to user'
      } catch (error) {
        logger.error('Tool execution failed', {
          ...params,
          ...spreadError(error),
        })
        return {
          error: 'Tool execution failed',
          details: error instanceof Error ? error.message : 'unknown',
        } satisfies ToolExecutionError
      }
    },
  })
