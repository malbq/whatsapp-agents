import { tool } from 'ai'
import { z } from 'zod'
import type { ToolExecutionError } from '../errors'
import { getMessageTypeFromMimeType } from '../utils/getMessageTypeFromMimeType'
import { spreadError } from '../utils/spreadError'

export interface SendFileDeps {
  userId: string
  findStorageKeyById: (params: {
    userId: string
    messageId: string
  }) => Promise<{ storageKey: string } | undefined>
  retrieveFile: (storageKey: string) => Promise<{
    data: Uint8Array
    mimeType: string
    filename: string
  }>
  sendImage: (params: {
    data: Uint8Array
    caption?: string
    mimeType: string
  }) => Promise<string>
  sendDocument: (params: {
    data: Uint8Array
    filename: string
    caption?: string
    mimeType: string
  }) => Promise<string>
  onExplanation?: (explanation: string) => Promise<void> | void
  onImageSent?: (externalChatId: string, storageKey: string, caption?: string) => void
  onDocumentSent?: (externalChatId: string, storageKey: string, caption?: string) => void
  validateMessageId?: (messageId: string) => boolean
}

export function createSendFileTool(deps: SendFileDeps, explanationPrompt: string) {
  return tool({
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
      explanation: z.string().describe(explanationPrompt),
    }),
    execute: async (params) => {
      try {
        const { messageId, caption, explanation } = params

        await deps.onExplanation?.(explanation)

        if (deps.validateMessageId && !deps.validateMessageId(messageId)) {
          console.error('messageId not found in last search results', params)
          return 'Please run search_files first and select a file from the results.'
        }

        const message = await deps.findStorageKeyById({ userId: deps.userId, messageId })
        if (!message) {
          console.error('message not found in storage', {
            ...params,
            userId: deps.userId,
          })
          return 'File not found. Please run search_files again.'
        }

        const fileInfo = await deps.retrieveFile(message.storageKey)
        const messageType = getMessageTypeFromMimeType(fileInfo.mimeType)

        if (!messageType) {
          console.error('unsupported file type', {
            ...params,
            mimeType: fileInfo.mimeType,
            storageKey: message.storageKey,
          })
          return `Unsupported file type: ${fileInfo.mimeType}. Only images and documents are supported`
        }

        if (messageType === 'image') {
          const externalChatId = await deps.sendImage({
            data: fileInfo.data,
            caption,
            mimeType: fileInfo.mimeType,
          })
          deps.onImageSent?.(externalChatId, message.storageKey, caption)
          console.log('image delivered', {
            ...params,
            mimeType: fileInfo.mimeType,
            captionLength: caption?.length ?? 0,
          })
          console.debug('sent image message', { ...params, externalChatId, storageKey: message.storageKey })
          return 'Image delivered to user'
        }

        const externalChatId = await deps.sendDocument({
          data: fileInfo.data,
          filename: fileInfo.filename,
          caption,
          mimeType: fileInfo.mimeType,
        })
        deps.onDocumentSent?.(externalChatId, message.storageKey, caption)
        console.log('document delivered', {
          ...params,
          filename: fileInfo.filename,
          mimeType: fileInfo.mimeType,
          captionLength: caption?.length ?? 0,
        })
        console.debug('sent document message', { ...params, externalChatId, storageKey: message.storageKey })
        return 'Document delivered to user'
      } catch (error) {
        console.error('Tool execution failed', {
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
}
