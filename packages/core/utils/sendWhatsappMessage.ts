import type { Chat } from '@batman/whatsapp'
import { ok } from 'node:assert'
import type { GeneratedWhatsappMessage } from '../ai/generateWhatsappMessage'
import type { DB } from '../infra/db'
import type { Storage } from '../infra/storage'

export async function sendWhatsappMessage({
  chat,
  db,
  storage,
  userId,
  userWaId,
  message,
}: {
  chat: Chat
  db: DB.Repository
  storage: Storage
  userId: string
  userWaId: string
  message: GeneratedWhatsappMessage
}): Promise<string> {
  switch (message.type) {
    case 'text': {
      const { type: _type, ...rest } = message
      return chat.sendText(userWaId, rest)
    }
    case 'location': {
      const { type: _type, ...rest } = message
      return chat.sendLocation(userWaId, rest)
    }
    case 'contact': {
      const { type: _type, ...rest } = message
      return chat.sendContact(userWaId, rest)
    }
    case 'interactive_button': {
      const { type: _type, ...rest } = message
      return chat.sendInteractiveButton(userWaId, rest)
    }
    case 'interactive_list': {
      const { type: _type, ...rest } = message
      return chat.sendInteractiveList(userWaId, rest)
    }
    case 'document': {
      const { type: _type, ...rest } = message
      const resource = await db.findResource({ userId, resourceId: message.resourceId })
      ok(resource, 'Resource not found')
      const file = await storage.retrieve(resource.storageKey)
      return chat.sendDocument(userWaId, {
        data: file.data,
        filename: resource.originalFilename ?? '',
        caption: rest.caption,
        mimeType: file.mimeType,
      })
    }
    case 'image': {
      const { type: _type, ...rest } = message
      const resource = await db.findResource({ userId, resourceId: message.resourceId })
      ok(resource, 'Resource not found')
      const file = await storage.retrieve(resource.storageKey)
      return chat.sendImage(userWaId, {
        data: file.data,
        caption: rest.caption,
        mimeType: file.mimeType,
      })
    }
    default: {
      // Prevent forgetting to handle a message type: Type '{ type: "video"; ... }' is not assignable to type 'never'
      const _exhaustive: never = message
      throw new Error(`Unsupported message type: ${(message as GeneratedWhatsappMessage).type}`)
    }
  }
}
