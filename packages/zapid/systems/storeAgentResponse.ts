import { toDbTokenUsage } from '@wa/core/utils/toDbUsage'
import type { ToolModelMessage } from 'ai'
import { ok } from 'node:assert'
import { getContext } from '../context'

export async function storeAgentResponse(): Promise<void> {
  const context = getContext()
  ok(context.user, 'User not found')
  ok(context.outbound, 'No outbound message to store')

  const { message, usages } = context.outbound

  // Store the bundled assistant message (single row)
  const [messageId] = await context.db.storeMessage(message)
  message.id = messageId

  console.debug('Stored outbound message', {
    messageId,
  })

  if (usages.length > 0) {
    const usageInserts = usages.map((u) =>
      toDbTokenUsage({
        messageId: messageId!,
        source: u.source,
        modelMessageIndex: u.modelMessageIndex,
        usage: u.usage,
      })
    )
    await context.db.storeTokenUsage(usageInserts)

    console.debug('Stored usage records', {
      count: usageInserts.length,
      messageId,
    })
  }

  if (context.improvedProfile && context.improvedProfile.length > 0) {
    // Find the tool result message for update_user_profile in the bundled messages
    const hasProfileUpdate = message.messages.some((m) => {
      if (m.role !== 'tool') return false
      const toolMessage = m as ToolModelMessage
      return toolMessage.content.some(
        (c) => c.type === 'tool-result' && c.toolName === 'update_user_profile'
      )
    })

    if (hasProfileUpdate && messageId) {
      await context.db.updateUserProfile({
        userId: context.user.id,
        profile: context.improvedProfile,
        messageId,
      })

      console.debug('Updated user profile', {
        currentProfile: context.user.profile,
        improvedProfile: context.improvedProfile,
      })
    }
  }
}
