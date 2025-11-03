import type { Hono } from 'hono'
import { createHmac } from 'node:crypto'
import type { Chat, Message, StatusUpdate } from './types'

export interface WebhookConfig {
  appSecret: string
  verifyToken: string
  path?: string
}

export interface WebhookHandlers {
  onMessage: (message: Message) => Promise<void> | void
  onStatusUpdate?: (statusUpdate: StatusUpdate) => Promise<void> | void
  onUnknownNotification?: (body: unknown) => Promise<void> | void
}

export function createWebhookRoutes(
  app: Hono,
  chat: Chat,
  config: WebhookConfig,
  handlers: WebhookHandlers
): void {
  const path = config.path ?? '/webhook'

  // Webhook verification endpoint
  // https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
  app.get(path, (c) => {
    const mode = c.req.query('hub.mode')
    const token = c.req.query('hub.verify_token')
    const challenge = c.req.query('hub.challenge')

    if (mode === 'subscribe' && token === config.verifyToken && challenge) {
      console.log('Webhook verified successfully')
      return c.text(challenge)
    }

    console.warn('Webhook verification failed', { mode, token: token ? '[REDACTED]' : undefined })
    return c.body('', 403)
  })

  // Webhook notification endpoint
  app.post(path, async (c) => {
    const headerSignature = c.req.header('x-hub-signature-256')
    const body = await c.req.text()

    if (!validateWebhookSignature(body, headerSignature, config.appSecret)) {
      console.warn('Webhook signature validation failed')
      return c.status(401)
    }

    const notification = await chat.parseNotification(JSON.parse(body))

    if (!notification) {
      await handlers.onUnknownNotification?.(JSON.parse(body))
      return c.body('', 200)
    }

    if (notification.statusUpdate) {
      await handlers.onStatusUpdate?.(notification.statusUpdate)
      return c.body('', 200)
    }

    if (notification.message) {
      await handlers.onMessage(notification.message)
      return c.body('', 200)
    }

    await handlers.onUnknownNotification?.(JSON.parse(body))
    return c.body('', 200)
  })
}

function validateWebhookSignature(
  body: string,
  signature: string | undefined,
  appSecret: string
): boolean {
  if (!signature) return false
  const headerSignature = signature.startsWith('sha256=') ? signature.slice(7) : signature
  const computedSignature = createHmac('sha256', appSecret).update(body).digest('hex')
  return computedSignature === headerSignature
}
