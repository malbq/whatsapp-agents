import { getLogger } from '@logtape/logtape'
import { getFileExtensionFromMimeType } from '../../utils/getFileExtensionFromMimeType'
import { sanitizeFilename } from '../../utils/sanitizeFilename'
import { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'mediaStorage'])

export async function MediaStorage(frame: Frame, deps: Deps) {
  if (
    !frame.user ||
    !frame.inbound?.media?.data ||
    !frame.inbound?.media?.mimeType ||
    (frame.inbound?.type !== 'image' && frame.inbound?.type !== 'document')
  )
    return

  const uuid = Bun.randomUUIDv7('base64url')
  const sanitizedFilename = sanitizeFilename(frame.inbound.media.filename || 'unnamed')
  const extension = getFileExtensionFromMimeType(frame.inbound.media.mimeType)
  const storageKey = `${frame.user.id}/${uuid}_${sanitizedFilename}.${extension}`

  await deps.storage.store({
    key: storageKey,
    data: frame.inbound.media.data,
    mimeType: frame.inbound.media.mimeType,
    filename: frame.inbound.media.filename,
  })
  frame.inbound.media.storageKey = storageKey

  logger.info(
    `Stored ${frame.inbound.type} media at "${storageKey}" (${frame.inbound.media.data.byteLength} bytes)`,
    {
      type: frame.inbound.type,
      mimeType: frame.inbound.media.mimeType,
      filename: frame.inbound.media.filename,
    }
  )
}
