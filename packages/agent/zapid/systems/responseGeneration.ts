import { ResponseGenerationError } from '@batman/core/errors'
import { extractFilename } from '@batman/core/utils/storageKey'
import { toSystemModelMessage } from '@batman/core/utils/toModelMessage'
import type { ModelMessage } from 'ai'
import { ok } from 'node:assert'
import type { Frame } from '../frame'
import { recentMessages as recentMessagesPrompt } from '../prompts/recentMessages'
import { userProfile } from '../prompts/userProfile'
import type { Deps } from '../types'

export async function responseGeneration(frame: Frame, deps: Deps) {
  ok(frame.user, new ResponseGenerationError('User not found'))

  // BUILD CONTEXT
  const messagesForAgent: Array<ModelMessage> = []

  if (frame.user.profile.length > 0) {
    messagesForAgent.push(userProfile(frame.user.profile))
    console.log('Context included: user profile')
  }

  // CONTEXT: RECENT THREAD
  const recentMessages = await deps.db.findRecentMessages({ userId: frame.user.id })
  if (recentMessages.length) {
    messagesForAgent.push(toSystemModelMessage(recentMessagesPrompt))
    for (const message of recentMessages) {
      // Extract role from modelMessage if present, otherwise infer from type
      const role = message.modelMessage
        ? (message.modelMessage as { role?: string }).role ?? 'user'
        : 'user'

      // Fetch filename from resource if present
      let filename: string | undefined
      if (message.resourceId) {
        const resource = await deps.db.findResource({
          userId: frame.user.id,
          resourceId: message.resourceId,
        })
        filename = resource?.originalFilename ? extractFilename(resource.storageKey) : undefined
      }

      messagesForAgent.push({
        role,
        content: formatWithTag(message.type, message.content, filename),
      })
    }
    console.log(`Context: recent messages (${recentMessages.length})`)
  }

  // USER MESSAGE CONTENT
  if (frame.inbound.media?.transcription) {
    messagesForAgent.push({
      role: 'user',
      content: formatWithTag(
        frame.inbound.type,
        frame.inbound.media?.transcription,
        frame.inbound.media?.filename
      ),
    })
  }
  if (frame.inbound.text) {
    messagesForAgent.push({ role: 'user', content: frame.inbound.text })
  }

  // Helper for sending explanation messages
  const sendExplanation = async (explanation: string) => {
    const externalChatId = await deps.chat.sendText({ text: explanation })
    frame.outboundMessages.push({
      externalChatId,
      type: 'text',
      text: explanation,
    })
  }

  // Track last search results for send_file validation
  let lastSearchResults: Array<{ messageId: string; filename: string | undefined }> = []

  try {
    const response = await deps.ai.respond({
      messages: messagesForAgent,
      tools: [],
    })

    for await (const chunk of response.stream) {
      const externalChatId = await deps.chat.sendText({ text: chunk })
      frame.outboundMessages.push({
        externalChatId,
        type: 'text',
        text: chunk,
      })
    }

    console.log(`Sent ${frame.outboundMessages.length} text message(s)`)
  } catch (error) {
    const errorText = 'Desculpe, tive algum problema ao tentar te responder.'
    const externalChatId = await deps.chat.sendText({ text: errorText })
    frame.outboundMessages.push({
      externalChatId,
      type: 'text',
      text: errorText,
    })
    throw error
  }
}

// Helper function to store outbound media files
async function storeOutboundMedia(
  frame: Frame,
  deps: Deps,
  data: ArrayBuffer,
  mimeType: string,
  filename?: string
): Promise<string> {
  if (!frame.user) throw new Error('User required for storing media')

  const uuid = Bun.randomUUIDv7('base64url')
  const { newStorageKey } = await import('@batman/core/utils/storageKey')
  const storageFilename = newStorageKey(uuid, filename, mimeType)
  const storageKey = `${frame.user.id}/${storageFilename}`

  await deps.storage.store({
    key: storageKey,
    data,
    mimeType,
    filename,
  })

  return storageKey
}
