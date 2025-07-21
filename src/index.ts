import chalk from 'chalk'
import { Hono } from 'hono'
import { createHmac } from 'node:crypto'
import { agent } from './agent'
import { handleStatusUpdate } from './features/handleStatusUpdate'
import { AIProvider } from './infra/ai'
import { Whatsapp } from './infra/chatWhatsapp'
import { LibSql } from './infra/dbLibSql'
import { FilesystemStorage } from './infra/storageFilesystem'

const { META_APP_SECRET } = process.env
if (!META_APP_SECRET) {
  throw new Error('Missing app secret in environment variables')
}

const deps: Deps = {
  chat: Whatsapp.chat,
  storage: FilesystemStorage.storage,
  ai: AIProvider,
  db: LibSql.db(),
}

export const app = new Hono()

app.get('/', async (c) => {
  return c.text('OK')
})

app.post('/webhook', async (c) => {
  try {
    const headerSignature = c.req.header('x-hub-signature-256')?.slice(7)
    if (!headerSignature) return c.status(401)

    const body = await c.req.text()
    const computedSignature = createHmac('sha256', META_APP_SECRET)
      .update(body)
      .digest('hex')

    if (computedSignature !== headerSignature) return c.status(401)

    console.debug(chalk.gray(body))
    const { chatUser, message, statusUpdate } = deps.chat.parseNotification(
      JSON.parse(body)
    )

    if (statusUpdate) {
      await handleStatusUpdate(statusUpdate)
      return c.body('', 200)
    }

    if (!chatUser || !message || !message.id) {
      console.debug(chalk.yellow('Unknown notification'))
      return c.body('', 200)
    }

    // store only messages, not status updates
    deps.db.storeWebhookEvent(body)
    console.debug(chalk.green(`${message.type} message`))
    if (message.type === 'unsupported') {
      return c.body('', 200)
    }

    deps.chat.acknowledgeProcessingMessage(message.to, message.id)
    const user =
      (await deps.db.findUser(chatUser.externalId)) ??
      (await deps.db.storeUser(chatUser))

    const agentResponse = await agent(deps, {
      user,
      userMessage: message,
    })

    // TODO: handle different response types
    await deps.chat.sendTextMessage({
      from: message.to,
      to: message.from,
      text: agentResponse.body,
    })

    return c.body('', 200)
  } catch (error) {
    console.error('webhook endpoint', error)
    return c.body('', 500)
  }
})

// https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
app.get('/webhook', function webhookVerificationRequest(c) {
  const mode = c.req.query('hub.mode')
  const token = c.req.query('hub.verify_token')
  const challenge = c.req.query('hub.challenge')

  if (
    mode === 'subscribe' &&
    token === process.env.WEBHOOK_VERIFY_TOKEN &&
    challenge
  ) {
    console.log('Webhook verified successfully!')
    return c.text(challenge)
  }
  console.log('Webhook verification failed!')
  return c.body('', 403)
})

export default {
  port: 8080,
  fetch: app.fetch,
}
