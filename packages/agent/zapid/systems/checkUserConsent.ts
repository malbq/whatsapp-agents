import type { IncomingMessage } from '@batman/whatsapp'
import { getContext } from '../context'

/**
 * Checks if user has consented to use the service and can use the service
 *
 * For content messages:
 * - If no consent: sends onboarding template, returns false
 * - If has consent: returns true
 *
 * For flow_reply (consent completion):
 * - Records consent, completes onboarding, returns true
 */
export async function checkUserConsent(): Promise<boolean> {
  const ctx = getContext()

  if (isConsentFlowReply(ctx.notification.message)) {
    await ctx.db.completeOnboarding({ userId: ctx.user.id })
    console.log('[checkUserConsent] Onboarding completed', { userId: ctx.user.id })

    return true
  }

  const hasConsent = await ctx.db.hasConsent({ userId: ctx.user.id })
  console.log('[checkUserConsent] Consent status', { userId: ctx.user.id, hasConsent })

  if (!hasConsent) {
    // TODO: track template sent in ephemeral KV to avoid spamming
    ctx.chat.sendTemplate(ctx.user.waId, {
      name: import.meta.env.WA_ONBOARDING_TEMPLATE,
      language: 'pt_BR',
      flowToken: 'onboarding',
    })
    console.log('Sent onboarding template', { userWaId: ctx.user.waId })
    return false
  }

  return true
}

function isConsentFlowReply(message: IncomingMessage): boolean {
  return message.type === 'flow_reply' && message.flowToken === 'onboarding'
}
