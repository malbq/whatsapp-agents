import { ok } from 'node:assert'
import { getContext } from '../context'

export async function storeAgentResponse(): Promise<void> {
  const context = getContext()
  ok(context.user, 'User not found')
  ok(context.outbound.length, 'No outbound messages to store')

  const messageIds = await context.db.storeMessage(context.outbound)

  console.log(`Stored ${messageIds.length} outbound messages`)

  for (let i = 0; i < context.outbound.length; i++) {
    context.outbound[i]!.id = messageIds[i]!
  }

  if (context.improvedProfile && context.improvedProfile.length > 0) {
    const messageId = context.outbound.find((m) => {
      return (
        m.modelMessage.role === 'tool' &&
        m.modelMessage.content.some(
          (c) => c.type === 'tool-result' && c.toolName === 'update_user_profile'
        )
      )
    })?.id

    if (messageId) {
      await context.db.updateUserProfile({
        userId: context.user.id,
        profile: context.improvedProfile,
        messageId,
      })

      console.log('Updated user profile', {
        userId: context.user.id,
        profileLength: context.improvedProfile.length,
      })
    }
  }
}
