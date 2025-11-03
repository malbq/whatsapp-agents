import { Frame } from '../frame'
import type { Deps } from '../types'
import { newStorageKey } from '../../../core/utils/storageKey'

//const logger = getLogger(['app', 'agent', 'storeMedia'])

export async function storeMedia(frame: Frame, deps: Deps) {
  if (
    !frame.user ||
    !frame.inbound?.media?.data ||
    !frame.inbound?.media?.mimeType ||
    (frame.inbound?.type !== 'image' && frame.inbound?.type !== 'document')
  )
    return

  const uuid = Bun.randomUUIDv7('base64url')
  const filename = newStorageKey(uuid, frame.inbound.media.filename, frame.inbound.media.mimeType)

  const storageKey = `${frame.user.id}/${filename}`

  await deps.storage.store({
    key: storageKey,
    data: frame.inbound.media.data,
    mimeType: frame.inbound.media.mimeType,
    filename: frame.inbound.media.filename,
  })
  frame.inbound.media.storageKey = storageKey

  console.log(
    `Stored ${frame.inbound.type} media at "${storageKey}" (${frame.inbound.media.data.byteLength} bytes)`,
    {
      type: frame.inbound.type,
      mimeType: frame.inbound.media.mimeType,
      filename: frame.inbound.media.filename,
    }
  )
}
