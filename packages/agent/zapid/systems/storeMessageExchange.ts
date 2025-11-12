import type { Message } from '@batman/core/infra/db'
import type { Frame } from '../frame'
import type { Deps } from '../types'

//const logger = getLogger(['app', 'agent', 'storeMessageExchange'])

export async function storeMessageExchange(frame: Frame, deps: Deps): Promise<void> {
  if (!frame.user || !frame.inbound) return
  if (frame.outboundMessages.length === 0) {
    console.warn('No outbound messages to store')
    return
  }

  const messagesToStore: Message[] = []

  // Handle inbound media message with transcription
  if (frame.inbound.media?.transcriptionEmbedding) {
    let resourceId: string | undefined
    if (frame.inbound.media.storageKey) {
      const resource = await deps.db.createResource({
        userId: frame.user.id,
        storageKey: frame.inbound.media.storageKey,
        mimeType: frame.inbound.media.mimeType,
        originalFilename: frame.inbound.media.filename,
      })
      resourceId = resource.id
    }

    messagesToStore.push({
      userId: frame.user.id,
      waId: frame.inbound.externalChatId,
      type: frame.inbound.type,
      modelMessage: {
        role: 'user',
        content: frame.inbound.media.transcription ?? '',
      },
      resourceId,
      content: frame.inbound.media.transcriptionEmbedding,
    })
  }

  // Handle inbound text message
  if (frame.inbound.textEmbedding) {
    messagesToStore.push({
      userId: frame.user.id,
      waId: frame.inbound.externalChatId,
      // when transcription is present we already stored a message with `inbound.type` (previous `if` block)
      // Then this must be a caption and we store it as `text` message
      type: frame.inbound.media?.transcriptionEmbedding ? 'text' : frame.inbound.type,
      modelMessage: {
        role: 'user',
        content: frame.inbound.text ?? '',
      },
      content: frame.inbound.textEmbedding,
    })
  }

  // Handle outbound messages
  for (const outboundMessage of frame.outboundMessages) {
    let resourceId: string | undefined
    if (outboundMessage.storageKey) {
      const resource = await deps.db.createResource({
        userId: frame.user.id,
        storageKey: outboundMessage.storageKey,
      })
      resourceId = resource.id
    }

    messagesToStore.push({
      userId: frame.user.id,
      waId: outboundMessage.externalChatId,
      type: outboundMessage.type,
      modelMessage: {
        role: 'assistant',
        content: outboundMessage.text,
      },
      content: outboundMessage.textEmbedding ?? [],
      resourceId,
    })
  }

  const messageIds = await deps.db.storeMessage(messagesToStore)
  frame.profileVersionSourceMessageId = messageIds.at(-frame.outboundMessages.length)

  const assistantMessageCount = frame.outboundMessages.length
  const inboundMessageCount = messagesToStore.length - assistantMessageCount

  console.log(
    `Stored ${messageIds.length} messages (${inboundMessageCount} user, ${assistantMessageCount} assistant)`,
    { messages: messagesToStore.map((m) => `${(m.modelMessage as any)?.role}/${m.type}`) }
  )
}
