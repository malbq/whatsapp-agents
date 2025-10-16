import { getLogger } from '@logtape/logtape'
import type { DbMessageInput } from '../../infra/db'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'storeMessageExchange'])

export async function storeMessageExchange(frame: Frame, deps: Deps): Promise<void> {
  if (!frame.user || !frame.inbound) return
  if (frame.outboundMessages.length === 0) {
    logger.warn('No outbound messages to store')
    return
  }

  const messagesToStore: DbMessageInput[] = []

  if (frame.inbound.media?.transcriptionEmbedding) {
    messagesToStore.push({
      userId: frame.user.id,
      role: 'user',
      externalId: frame.inbound.externalChatId,
      type: frame.inbound.type,
      storageKey: frame.inbound.media.storageKey,
      content: frame.inbound.media.transcriptionEmbedding,
    })
  }

  if (frame.inbound.textEmbedding) {
    messagesToStore.push({
      userId: frame.user.id,
      role: 'user',
      externalId: frame.inbound.externalChatId,
      // when transcription is present we already stored a message with `inbound.type` (previous `if` block)
      // Then this must be a caption and we store it as `text` message
      type: frame.inbound.media?.transcriptionEmbedding ? 'text' : frame.inbound.type,
      content: frame.inbound.textEmbedding,
    })
  }

  for (const outboundMessage of frame.outboundMessages) {
    messagesToStore.push({
      userId: frame.user.id,
      role: 'assistant',
      externalId: outboundMessage.externalChatId,
      type: outboundMessage.type,
      content: outboundMessage.textEmbedding ?? [],
      storageKey: outboundMessage.storageKey,
    })
  }

  const messageIds = await deps.db.storeMessage(messagesToStore)
  frame.profileVersionSourceMessageId = messageIds.at(-frame.outboundMessages.length)

  const assistantMessageCount = frame.outboundMessages.length
  const inboundMessageCount = messagesToStore.length - assistantMessageCount

  logger.info(
    `Stored ${messageIds.length} messages (${inboundMessageCount} user, ${assistantMessageCount} assistant)`,
    { messages: messagesToStore.map((m) => `${m.role}/${m.type}`) }
  )
}
