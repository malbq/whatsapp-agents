type MediaMessageType = 'document' | 'image'

export function getMessageTypeFromMimeType(mimeType: string): MediaMessageType | undefined {
  const cleanMimeType = mimeType.split(';')[0]?.trim().toLowerCase()
  if (!cleanMimeType) return undefined
  return image.has(cleanMimeType) ? 'image' : document.has(cleanMimeType) ? 'document' : undefined
}

const image = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
])
const document = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
])
