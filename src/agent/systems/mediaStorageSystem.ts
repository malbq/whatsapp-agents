import { getLogger } from '@logtape/logtape'
import { ComponentNotFoundError } from '../../errors'
import { spreadError } from '../../utils/spreadError'
import { Frame, type EntityId } from '../frame'

const logger = getLogger(['app', 'agent', 'mediaStorage'])

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
    logger.info`Stored ${message.type} media at ${storageKey}`
  } catch (error) {
    logger.error('Media storage error', { ...spreadError(error) })
  }
}
