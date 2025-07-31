import chalk from 'chalk'
import { Hono } from 'hono'
import { contextStorage } from 'hono/context-storage'
import { logger } from 'hono/logger'
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHmac } from 'node:crypto'
import { agent } from './agent'
import { FailedToPersistUserError, MediaHashMismatchError } from './errors'
import { handleStatusUpdate } from './features/handleStatusUpdate'
import { AIProvider } from './infra/ai'
import { Whatsapp } from './infra/chatWhatsapp'
import { LibSql } from './infra/dbLibSql'
import { FilesystemStorage } from './infra/storageFilesystem'

const { META_APP_SECRET } = process.env
if (!META_APP_SECRET) {
  throw new Error('Missing app secret in environment variables')
}

const store = new AsyncLocalStorage<Map<string, any>>()
export type Store = typeof store

const deps: Deps = {
  chat: Whatsapp.chat(store),
  storage: FilesystemStorage.storage(),
  ai: AIProvider,
  db: LibSql.db(),
}

export const app = new Hono()
app.use(logger())
app.use(contextStorage())

app.get('/', async (c) => {
  return c.text('OK')
})

app.post('/webhook', async (c) => {
  try {
    // TODO: how to early respond webhook request withou waiting for agent promise to resolve?
    await store.run(new Map(), async () => {
      const headerSignature = c.req.header('x-hub-signature-256')?.slice(7)
      if (!headerSignature) return c.status(401)

      const body = await c.req.text()
      const computedSignature = createHmac('sha256', META_APP_SECRET).update(body).digest('hex')

      if (computedSignature !== headerSignature) return c.status(401)

      const { message, statusUpdate } = await deps.chat.parseNotification(JSON.parse(body))

      if (statusUpdate) {
        await handleStatusUpdate(statusUpdate)
        return c.body('', 200)
      }

      if (!message) {
        console.warn(chalk.yellow('Unknown notification:', body))
        return c.body('', 200)
      }

      console.debug(chalk.gray(body))
      // store only messages, not status updates
      deps.db.storeWebhookEvent(body)
      if (message.type === 'unsupported') {
        return c.body('', 200)
      }

      await agent(deps, message)
    })
    return c.body('', 200)
  } catch (error) {
    if (error instanceof MediaHashMismatchError || error instanceof FailedToPersistUserError) {
      return c.body('', 200)
    }
    console.error('webhook endpoint')
    console.error(error)
    return c.body('', 500)
  }
})

// https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
app.get('/webhook', function webhookVerificationRequest(c) {
  const mode = c.req.query('hub.mode')
  const token = c.req.query('hub.verify_token')
  const challenge = c.req.query('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN && challenge) {
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
