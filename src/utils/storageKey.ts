import { getExtFromMimeType } from './getExtFromMimeType'
import { sanitizeFilename } from './sanitizeFilename'

export function newStorageKey(
  uuid: string,
  filename: string | undefined,
  mimeType: string
): string {
  return filename
    ? `${uuid}_${sanitizeFilename(filename)}`
    : `${uuid}.${getExtFromMimeType(mimeType)}`
}

export function extractFilename(storageKey?: string): string | undefined {
  if (!storageKey) return undefined
  const filenamePart = storageKey.split('/').pop()!
  return filenamePart.includes('_') ? filenamePart.split('_').slice(1).join('_') : filenamePart
}
