import type { MessageNotification } from '@wa/whatsapp'
import * as Sentry from '@sentry/bun'
import { agent } from './agent'
import { runContext, type AgentDeps } from './context'
import { ingest, isContentMessage } from './ingest'
import { checkUserConsent } from './systems/checkUserConsent'
import { hasQuotaRemaining } from './systems/entitlements'

/** Handles one inbound WhatsApp message: identify user, ingest, gate on consent/quota, reply */
export function createMessageHandler(deps: AgentDeps) {
  const { db, chat } = deps

  return async (notification: MessageNotification, raw: string) => {
    db.storeRawIncomingMessage(raw)
    const { message, userWaId, userName } = notification
    console.debug('Notification received', { notification })

    if (message.type === 'reaction') {
      console.debug('Skip reaction message')
      return
    }

    chat.acknowledgeMessage(message.messageWaId)

    const user = await db.persistUser({ waId: userWaId, name: userName })
    const entitlements = await db.getUserEntitlements({ userId: user.id })
    Sentry.setUser({ id: user.id, username: user.name, waId: user.waId })

    await runContext({ ...deps, notification, user, entitlements }, async () => {
      const hasConsented = await checkUserConsent()
      console.debug('User identified', {
        user,
        hasConsented,
        features: entitlements.features,
        quotas: entitlements.quotas,
      })

      if (isContentMessage(message)) {
        await ingest()
      }

      if (!hasConsented) return

      if (!hasQuotaRemaining('n_messages_per_day')) {
        console.warn('Message quota exceeded')
        await chat.sendText(userWaId, {
          text: '🤐 _You have reached your daily message limit._',
        })
        return
      }

      await agent()
    })
  }
}
