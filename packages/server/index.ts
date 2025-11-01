import { Hono } from 'hono'
import { websocket } from 'hono/bun'
import { contextStorage } from 'hono/context-storage'
import { createHmac } from 'node:crypto'
import { agent } from '../core/agent'
import { AIProvider } from '../core/ai'
import { MediaHashMismatchError } from '../core/errors'
import { LibSql } from '../core/infra/dbLibSql'
import { FilesystemStorage } from '../core/infra/storageFilesystem'
import { WebSearchBrave } from '../core/infra/webSearchBrave'
import { spreadError } from '../core/utils/spreadError'
import { validateEnvVars } from '../core/utils/validateEnv'
import { Whatsapp } from '../whastapp/index'
import { configureLogging } from './config/logging'
import type { Env } from './context'
import { extractCommand, sendCommandMessage } from './echo'
import { loggingMiddleware } from './middleware/logging'

validateEnvVars()
await configureLogging()

//const logger = getLogger(['app'])

const version = (await import('../package.json')).version
console.log(`Starting server v${version}`)

const deps: Deps = {
  db: LibSql.db(),
  storage: FilesystemStorage.storage(),
  chat: Whatsapp.chat,
  ai: AIProvider,
  webSearch: WebSearchBrave.searchWeb(),
}

const app = new Hono<Env>()
app.use(contextStorage())

app.get('/', async (c) => {
  return c.text('OK')
})

app.use('/webhook', loggingMiddleware)
app.post('/webhook', async (c) => {
  try {
    const headerSignature = c.req.header('x-hub-signature-256')?.slice(7)
    if (!headerSignature) return c.status(401)

    const body = await c.req.text()
    const computedSignature = createHmac('sha256', import.meta.env.META_APP_SECRET)
      .update(body)
      .digest('hex')

    if (computedSignature !== headerSignature) return c.status(401)

    const { message, statusUpdate } = await deps.chat.parseNotification(JSON.parse(body))

    if (statusUpdate) {
      return c.body('', 200)
    }

    if (!message) {
      console.warn('Unknown notification received', { body })
      return c.body('', 200)
    }

    const command = extractCommand(message)
    if (command) {
      await sendCommandMessage(deps.chat, command, message.externalId)
      return c.body('', 200)
    }

    const isNew = await deps.db.storeWebhookEvent(body, message.externalId)
    if (!isNew) {
      console.log('Message already processed, skipping', { externalId: message.externalId })
      return c.body('', 200)
    }

    if (message.type === 'unsupported') {
      console.warn('Unsupported message type received', { externalId: message.externalId })
      return c.body('', 200)
    }

    agent(deps, message).catch((error) => {
      console.error('Error bubbling up from agent', { ...spreadError(error) })
    })
    return c.body('', 200)
  } catch (error) {
    if (error instanceof MediaHashMismatchError) {
      return c.body('', 200)
    }
    console.error('Webhook endpoint error', { ...spreadError(error) })
    return c.body('', 500)
  }
})

// https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
app.get('/webhook', function webhookVerificationRequest(c) {
  const mode = c.req.query('hub.mode')
  const token = c.req.query('hub.verify_token')
  const challenge = c.req.query('hub.challenge')

  if (mode === 'subscribe' && token === import.meta.env.META_WEBHOOK_VERIFY_TOKEN && challenge) {
    console.log('Webhook verified successfully')
    return c.text(challenge)
  }
  console.warn('Webhook verification failed')
  return c.body('', 403)
})

export default {
  port: parseInt(import.meta.env.PORT),
  fetch: app.fetch,
  websocket,
}
