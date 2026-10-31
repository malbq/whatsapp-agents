import { describe, expect, mock, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import type { Chat, MessageNotification } from './types'
import { createWebhookApp } from './webhook'

const appSecret = 'test-secret'
const verifyToken = 'test-verify-token'

const notification: MessageNotification = {
  userWaId: '15550001234',
  userName: 'Test User',
  userPhone: '15550001234',
  timestamp: new Date(0),
  message: { type: 'text', messageWaId: 'wamid.in.1', text: 'hello' },
}

function createApp(onMessage = mock(async () => {})) {
  const chat = { parseNotification: async () => notification } as unknown as Chat
  return { app: createWebhookApp(chat, { appSecret, verifyToken }, { onMessage }), onMessage }
}

function sign(body: string, secret = appSecret) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

function post(app: ReturnType<typeof createApp>['app'], body: string, signature?: string) {
  return app.request('/', {
    method: 'POST',
    body,
    headers: signature ? { 'x-hub-signature-256': signature } : {},
  })
}

describe('createWebhookApp', () => {
  test('answers the verification challenge with the right token', async () => {
    const { app } = createApp()
    const ok = await app.request(
      `/?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=42`
    )
    expect(ok.status).toBe(200)
    expect(await ok.text()).toBe('42')

    const denied = await app.request('/?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=42')
    expect(denied.status).toBe(401)
  })

  test('dispatches signed notifications', async () => {
    const { app, onMessage } = createApp()
    const body = JSON.stringify({ object: 'whatsapp_business_account' })

    const response = await post(app, body, sign(body))
    await Bun.sleep(0)

    expect(response.status).toBe(200)
    expect(onMessage).toHaveBeenCalledWith(notification, body)
  })

  test.each([
    ['missing', undefined],
    ['wrong secret', sign('{}', 'other-secret')],
    ['malformed', 'sha256=not-hex'],
  ])('rejects %s signatures with 401', async (_, signature) => {
    const { app, onMessage } = createApp()
    const response = await post(app, '{}', signature)
    expect(response.status).toBe(401)
    expect(onMessage).not.toHaveBeenCalled()
  })

  test('still acknowledges when the handler fails', async () => {
    const { app } = createApp(
      mock(async () => {
        throw new Error('boom')
      })
    )
    const body = '{}'
    const response = await post(app, body, sign(body))
    await Bun.sleep(0)
    expect(response.status).toBe(200)
  })
})
