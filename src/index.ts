import { getLogger } from '@logtape/logtape'
import { Hono } from 'hono'
import { contextStorage, getContext as getContextHono } from 'hono/context-storage'
import { createHmac } from 'node:crypto'
import { agent } from './agent'
import { configureLogging } from './config/logging'
import { MediaHashMismatchError } from './errors'
import { handleStatusUpdate } from './features/handleStatusUpdate'
import { AIProvider } from './infra/ai'
import { Whatsapp } from './infra/chatWhatsapp'
import { LibSql } from './infra/dbLibSql'
import { FilesystemStorage } from './infra/storageFilesystem'
import { loggingMiddleware } from './middleware/logging'
import { spreadError } from './utils/spreadError'
import { validateEnvVars } from './utils/validateEnv'

await configureLogging()

const logger = getLogger(['app'])

const db = LibSql.db()
const deps: Deps = {
  db,
  storage: FilesystemStorage.storage(),
  chat: Whatsapp.chat,
  ai: AIProvider(db),
}

type Env = {
  Variables: {
    businessPhoneNumberId?: string
    userWhatsappId?: string
    userId?: string
  }
}
export const getContext = () => getContextHono<Env>()

const app = new Hono<Env>()
app.use(loggingMiddleware)
app.use(contextStorage())

app.get('/', async (c) => {
  return c.text('OK')
})

app.post('/webhook', async (c) => {
  try {
    validateEnvVars()
    const headerSignature = c.req.header('x-hub-signature-256')?.slice(7)
    if (!headerSignature) return c.status(401)

    const body = await c.req.text()
    logger.debug('Processing webhook notification', { body })
    const computedSignature = createHmac('sha256', import.meta.env.META_APP_SECRET)
      .update(body)
      .digest('hex')

    if (computedSignature !== headerSignature) return c.status(401)

    const { message, statusUpdate } = await deps.chat.parseNotification(JSON.parse(body))

    if (statusUpdate) {
      await handleStatusUpdate(statusUpdate)
      return c.body('', 200)
    }

    if (!message) {
      logger.warn('Unknown notification received', { body })
      return c.body('', 200)
    }

    // store only messages, not status updates
    deps.db.storeWebhookEvent(body)
    if (message.type === 'unsupported') {
      return c.body('', 200)
    }

    agent(deps, message).catch((error) => {
      logger.error('Error bubbling up from agent', { ...spreadError(error) })
    })
    return c.body('', 200)
  } catch (error) {
    if (error instanceof MediaHashMismatchError) {
      return c.body('', 200)
    }
    logger.error('Webhook endpoint error', { ...spreadError(error) })
    return c.body('', 500)
  }
})

// https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
app.get('/webhook', function webhookVerificationRequest(c) {
  const mode = c.req.query('hub.mode')
  const token = c.req.query('hub.verify_token')
  const challenge = c.req.query('hub.challenge')

  if (mode === 'subscribe' && token === import.meta.env.WEBHOOK_VERIFY_TOKEN && challenge) {
    logger.info('Webhook verified successfully')
    return c.text(challenge)
  }
  logger.warn('Webhook verification failed')
  return c.body('', 403)
})

export default {
  port: 8080,
  fetch: app.fetch,
}
