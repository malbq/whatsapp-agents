import { ok } from 'node:assert'
import { getContext } from '../context'

export async function storeMessageExchange(): Promise<void> {
  const context = getContext()
  ok(context.user, 'User not found')
  ok(context.inbound, 'Inbound message not found')
  ok(context.outbound.length, 'No outbound messages to store')

  try {
    if (context.inbound.type === 'image' || context.inbound.type === 'document') {
      const rawMessage = context.notification.message
      ok(rawMessage.type === 'image' || rawMessage.type === 'document', 'Raw message type mismatch')
      ok(rawMessage.data, 'Message data not found')

      const hash = Bun.hash(rawMessage.data).toString(16)
      const existingResourceId = await context.db.findResourceIdByHash({
        userId: context.user.id,
        hash,
      })

      if (existingResourceId) {
        console.log(`Found existing resource ${existingResourceId}, reusing it`)
        context.inbound.resourceId = existingResourceId
      } else {
        const uuid = Bun.randomUUIDv7('base64url')
        const storageKey = `${context.user.id}/${uuid}`

        await context.storage.store({
          key: storageKey,
          data: rawMessage.data,
          mimeType: rawMessage.mimeType,
        })

        const resource = await context.db.createResource({
          userId: context.user.id,
          storageKey,
          size: rawMessage.data.byteLength,
          mimeType: rawMessage.mimeType,
          hash,
          originalFilename: rawMessage.type === 'document' ? rawMessage.filename : undefined,
        })
        context.inbound.resourceId = resource.id
        console.log(`Stored ${context.inbound.type} media`, {
          type: context.inbound.type,
          size: rawMessage.data.byteLength,
          storageKey: resource.storageKey,
          mimeType: rawMessage.mimeType,
          filename: rawMessage.type === 'document' ? rawMessage.filename : undefined,
          resourceId: resource.id,
        })
      }

      if (Array.isArray(context.inbound.modelMessage.content)) {
        for (const part of context.inbound.modelMessage.content) {
          if ('image' in part) part.image = ''
          if ('data' in part) part.data = ''
        }
      }
    }
  } catch (error) {
    console.error('Error storing media', error)
  }

  const messagesToStore = [context.inbound, ...context.outbound]
  const messageIds = await context.db.storeMessage(messagesToStore)

  console.log(`Stored ${messageIds.length} messages (1 user, ${context.outbound.length} assistant)`)

  context.inbound.id = messageIds[0]!
  for (let i = 0; i < context.outbound.length; i++) {
    context.outbound[i]!.id = messageIds[i + 1]!
  }

  if (context.improvedProfile && context.improvedProfile.length > 0 && context.inbound.id) {
    await context.db.updateUserProfile({
      userId: context.user.id,
      profile: context.improvedProfile,
      messageId: context.inbound.id,
    })

    console.log('updated user profile', {
      userId: context.user.id,
      profileLength: context.improvedProfile.length,
    })
  }
}
