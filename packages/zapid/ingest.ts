import type { DB } from '@wa/core/infra/db'
import { toDbMessage } from '@wa/core/utils/toDbMessage'
import { toDbTokenUsage } from '@wa/core/utils/toDbUsage'
import { toUserModelMessage } from '@wa/core/utils/toModelMessage'
import type { IncomingMessage } from '@wa/whatsapp'
import { ok } from 'node:assert'
import { getContext } from './context'
import { embedInboundMessage } from './systems/embedInboundMessage'

export async function ingest(): Promise<void> {
  const context = getContext()
  const { notification, user } = context
  const message = notification.message
  if (!isContentMessage(message)) return

  ok(user, 'User must be set before ingesting message')

  const { message: modelMessage, usage } = await toUserModelMessage(message)
  const inbound = toDbMessage({
    userId: user.id,
    notification,
    modelMessage,
  })

  if (inbound.type === 'image' || inbound.type === 'document') {
    await storeMedia(inbound, message)
  }

  const [messageId] = await context.db.storeMessage(inbound)
  inbound.id = messageId

  if (usage && messageId) {
    await context.db.storeTokenUsage(
      toDbTokenUsage({
        messageId,
        source: 'audio_transcription',
        usage,
      })
    )
    console.debug('Stored audio transcription usage', { messageId })
  }

  console.info('Ingested message', {
    messageId,
    waMessageId: inbound.waId,
    messageType: inbound.type,
  })

  // Embed asynchronously (best-effort, don't block response)
  embedInboundMessage(inbound, message).catch((error) => {
    console.error('Failed to embed inbound message', { error })
  })
}

export function isContentMessage(message: IncomingMessage) {
  return (
    message.type === 'text' ||
    message.type === 'voice' ||
    message.type === 'audio' ||
    message.type === 'image' ||
    message.type === 'document' ||
    message.type === 'location' ||
    message.type === 'contact'
  )
}

async function storeMedia(inbound: DB.MessageInsert, message: IncomingMessage): Promise<void> {
  const context = getContext()

  if (message.type !== 'image' && message.type !== 'document') return
  if (!('data' in message) || !message.data) return

  const hash = Bun.hash(message.data).toString(16)
  const existingResourceId = await context.db.findResourceIdByHash({
    userId: context.user!.id,
    hash,
  })

  if (existingResourceId) {
    console.info('Reusing existing resource', { existingResourceId })
    inbound.resourceId = existingResourceId
    return
  }

  const uuid = Bun.randomUUIDv7('base64url')
  const storageKey = `${context.user!.id}/${uuid}`

  await context.storage.store({
    key: storageKey,
    data: message.data,
    mimeType: message.mimeType,
  })

  const resource = await context.db.createResource({
    userId: context.user!.id,
    storageKey,
    size: message.data.byteLength,
    mimeType: message.mimeType,
    hash,
    originalFilename: message.type === 'document' ? message.filename : undefined,
  })

  inbound.resourceId = resource.id

  console.info('Stored media', {
    type: inbound.type,
    size: message.data.byteLength,
    storageKey: resource.storageKey,
    mimeType: message.mimeType,
    filename: message.type === 'document' ? message.filename : undefined,
    resourceId: resource.id,
  })

  // Clear binary data from messages before it gets stored
  // User messages have a single element in the messages array
  const modelMessage = inbound.messages[0]
  if (modelMessage && Array.isArray(modelMessage.content)) {
    for (const part of modelMessage.content) {
      if ('image' in part) part.image = ''
      if ('data' in part) part.data = ''
    }
  }
}
