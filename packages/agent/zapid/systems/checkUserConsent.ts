import type { IncomingMessage } from '@batman/whatsapp'
import { ok } from 'node:assert'
import { getContext } from '../context'

ok(import.meta.env.WA_ONBOARDING_TEMPLATE, 'WA_ONBOARDING_TEMPLATE is required')

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

    // Refresh entitlements after onboarding since plan was just activated
    const freshEntitlements = await ctx.db.getUserEntitlements({ userId: ctx.user.id })
    ctx.entitlements = freshEntitlements

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
