import chalk from 'chalk'
import type { DbMessageInput } from '../../infra/db'
import type { Frame } from '../frame'

export async function StoreMessageExchangeSystem(frame: Frame, deps: Deps): Promise<void> {
  console.debug(chalk.green('StoreMessageExchangeSystem'))
  const user = frame.getComponent(frame.USER_ENTITY_ID, 'User')!

  const messages = frame
    .query(['Message', 'TextContent'])
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
      mediaStorageKey: storedMedia?.storageKey,
    }))
  await deps.db.storeMessage(messages)
  console.debug(
    chalk.gray(
      'messages:',
      JSON.stringify(
        messages.map((m) => ({
          ...m,
          content: m.content.map((c) => ({
            ...c,
            embedding: '...',
          })),
        })),
        null,
        2
      )
    )
  )
  console.debug(chalk.gray('stored message exchange'))
}
