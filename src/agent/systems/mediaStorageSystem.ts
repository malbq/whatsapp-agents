import chalk from 'chalk'
import { ComponentNotFoundError } from '../../errors'
import { Frame, type EntityId } from '../frame'

export async function MediaStorageSystem(frame: Frame, deps: Deps, messageEntity: EntityId) {
  try {
    const message = frame.getComponent(messageEntity, 'Message')
    if (!message) throw new ComponentNotFoundError(messageEntity, 'Message')

    const userId = frame.getComponent(frame.USER_ENTITY_ID, 'User')?.id
    if (!userId) throw new ComponentNotFoundError(frame.USER_ENTITY_ID, 'User')

    if (message.type !== 'image' && message.type !== 'document') return

    const media = frame.getComponent(messageEntity, 'Media')
    if (!media) return

    const storageKey = `${userId}/${Bun.randomUUIDv7('base64url')}`
    frame.query(['Message']).forEach((entityId) => {
      frame.addComponent(entityId, 'StoredMedia', {
        storageKey: storageKey,
      })
    })
    await deps.storage.store({
      key: storageKey,
      data: media.data,
      mimeType: media.mimeType,
    })
    console.debug(chalk.green('MediaStorageSystem'))
    console.debug(chalk.gray(`stored ${message.type} media at ${storageKey}`))
  } catch (error) {
    console.error('MediaStorageSystem error:', error)
  }
}
