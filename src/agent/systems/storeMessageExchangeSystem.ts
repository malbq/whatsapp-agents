import { getLogger } from '@logtape/logtape'
import type { DbMessageInput } from '../../infra/db'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'storeMessageExchange'])

export async function StoreMessageExchangeSystem(frame: Frame, deps: Deps): Promise<void> {
  const user = frame.getComponent(frame.USER_ENTITY_ID, 'User')!

  const messageEntities = frame.query(['Message', 'TextContent'])
  const messages = messageEntities
    .map((messageEntity) => ({
      message: frame.getComponent(messageEntity, 'Message')!,
      vectorEmbedding: frame.getComponent(messageEntity, 'VectorEmbedding')!,
      storedMedia: frame.getComponent(messageEntity, 'StoredMedia'),
    }))
    .sort((a, b) => a.message.priority - b.message.priority)
    .map<DbMessageInput>(({ message, storedMedia, vectorEmbedding }) => ({
      externalId: message.externalId,
      userId: user.id,
      role: message.role,
      type: message.type,
      content: vectorEmbedding.chunks,
      storageKey: storedMedia?.storageKey,
    }))

  const messageIds = await deps.db.storeMessage(messages)

  messageEntities.forEach((messageEntity, index) => {
    frame.addComponent(messageEntity, 'MessageId', { id: messageIds[index]! })
  })

  logger.info('Stored {messagesLength} messages', { messagesLength: messages.length })
}
