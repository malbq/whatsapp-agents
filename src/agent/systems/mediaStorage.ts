import { getLogger } from '@logtape/logtape'
import { getFileExtensionFromMimeType } from '../../utils/getFileExtensionFromMimeType'
import { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'mediaStorage'])

export async function MediaStorage(frame: Frame, deps: Deps) {
  if (
    !frame.user ||
    !frame.inbound?.media ||
    (frame.inbound?.type !== 'image' && frame.inbound?.type !== 'document')
  )
    return

  const storageKey = `${frame.user.id}/${Bun.randomUUIDv7(
    'base64url'
  )}.${getFileExtensionFromMimeType(frame.inbound.media.mimeType)}`
  await deps.storage.store({
    key: storageKey,
    data: frame.inbound.media.data,
    mimeType: frame.inbound.media.mimeType,
    filename: frame.inbound.media.filename,
  })
  frame.inbound.media.storageKey = storageKey

  logger.info(`Stored ${frame.inbound.type} media at ${storageKey}`)
}
