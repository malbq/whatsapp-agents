import type { IncomingMessage } from '@wa/whatsapp'
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

    // Refresh entitlements after onboarding since plan was just activated
    const freshEntitlements = await ctx.db.getUserEntitlements({ userId: ctx.user.id })
    ctx.entitlements = freshEntitlements
    console.info('Onboarding completed, refreshed entitlements')

    return true
  }

  const hasConsent = await ctx.db.hasConsent({ userId: ctx.user.id })
  if (!hasConsent) {
    // TODO: track template sent in ephemeral KV to avoid spamming
    ctx.chat.sendTemplate(ctx.user.waId, {
      name: ctx.onboardingTemplate,
      language: 'en_US',
      flowToken: 'onboarding',
    })
    console.info("User hasn't consented, sent onboarding template")
    return false
  }

  return true
}

function isConsentFlowReply(message: IncomingMessage): boolean {
  return message.type === 'flow_reply' && message.flowToken === 'onboarding'
}
