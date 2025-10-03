import { getLogger } from '@logtape/logtape'
import type { DbMessageInput } from '../../infra/db'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'storeMessageExchange'])

export async function storeMessageExchange(frame: Frame, deps: Deps): Promise<void> {
  if (!frame.user || !frame.inbound || !frame.outbound) return

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
      // when media has transcription we already stored a message with inbound.type
      // Then we store this one as text message (may be doc/image caption)
      type: frame.inbound.media?.transcriptionEmbedding ? 'text' : frame.inbound.type,
      content: frame.inbound.textEmbedding,
    })
  }

  messagesToStore.push({
    userId: frame.user.id,
    role: 'assistant',
    externalId: frame.outbound.externalChatId,
    type: frame.outbound.type,
    content: frame.outbound.textEmbedding ?? [],
  })

  const messageIds = await deps.db.storeMessage(messagesToStore)

  switch (messageIds.length) {
    case 0:
      logger.warn(`Stored no messages`)
      break
    case 1:
      logger.warn(`Stored only 1 message (${messagesToStore[0]?.role}/${messagesToStore[0]?.type})`)
      break
    default:
      logger.info(
        `Stored ${messageIds.length} messages (${messagesToStore
          .map((m) => `${m.role}/${m.type}`)
          .join(', ')})`
      )
      break
  }

  frame.inbound.messageId = messageIds.at(-2)
  frame.outbound.messageId = messageIds.at(-1)
}
