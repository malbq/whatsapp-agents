import { getLogger } from '@logtape/logtape'
import type { DbMessageInput, MessageRole } from '../../infra/db'
import type { Frame, FrameMessage } from '../frame'

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

    if (frame.inbound.textEmbedding) {
      messagesToStore.push({
        userId: frame.user.id,
        role: 'user',
        externalId: frame.inbound.externalChatId,
        type: 'text',
        content: frame.inbound.textEmbedding,
      })
    }
  } else {
    messagesToStore.push(mapMessageToDb(frame.inbound, frame.user.id, 'user'))
  }
  messagesToStore.push(mapMessageToDb(frame.outbound, frame.user.id, 'assistant'))

  const messageIds = await deps.db.storeMessage(messagesToStore)

  if (frame.inbound.textEmbedding) {
    // either [0] for text/voice or [1] for media caption
    frame.inbound.messageId = messageIds.at(-2)
  }

  logger.info(`Stored ${messageIds.length} messages`)
}

function mapMessageToDb(message: FrameMessage, userId: string, role: MessageRole): DbMessageInput {
  const content = message.textEmbedding ??
    message.media?.transcriptionEmbedding ?? [{ content: message.text ?? '', embedding: [] }]

  return {
    userId,
    role,
    externalId: message.externalChatId,
    type: message.type,
    content,
    storageKey: message.media?.storageKey,
  }
}
