import { Hono } from 'hono'
import { createHmac } from 'node:crypto'
import type { Chat, MessageNotification, StatusUpdateNotification } from './types'

export interface WebhookConfig {
  appSecret: string
  verifyToken: string
}

export interface WebhookHandlers {
  onMessage: (notification: MessageNotification) => Promise<void> | void
  onStatusUpdate?: (statusUpdate: StatusUpdateNotification) => Promise<void> | void
  onUnknownNotification?: (body: unknown) => Promise<void> | void
}

export function createWebhookApp(
  chat: Chat,
  config: WebhookConfig,
  handlers: WebhookHandlers
): Hono {
  const app = new Hono()

  // Webhook verification endpoint
  // https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
  app.get('/', (c) => {
    const mode = c.req.query('hub.mode')
    const token = c.req.query('hub.verify_token')
    const challenge = c.req.query('hub.challenge')

    if (mode === 'subscribe' && token === config.verifyToken && challenge) {
      console.log('Webhook verified successfully')
      return c.text(challenge)
    }

    console.warn('Webhook verification failed')
    return c.body(null, 401)
  })

  // Webhook notification endpoint
  app.post('/', async (c) => {
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

    if ('statusUpdate' in notification) {
      await handlers.onStatusUpdate?.(notification)
      return c.body('', 200)
    }

    if ('message' in notification) {
      console.debug('WhatsApp message received:', body)
      await handlers.onMessage(notification)
      return c.body('', 200)
    }

    await handlers.onUnknownNotification?.(JSON.parse(body))
    return c.body('', 200)
  })

  return app
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
