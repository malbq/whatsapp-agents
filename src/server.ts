import chalk from 'chalk'
import { Hono } from 'hono'
import { createHmac } from 'node:crypto'
import { handleAudioMessage } from './features/handleAudioMessage'
import { handleDocumentMessage } from './features/handleDocumentMessage'
import { handleImageMessage } from './features/handleImageMessage'
import { handleStatusUpdate } from './features/handleStatusUpdate'
import { handleTextMessage } from './features/handleTextMessage'
import { handleUnsupportedMessage } from './features/handleUnsupportedMessage'
import { AI } from './infra/ai'
import { WA } from './infra/whatsapp'

const { META_APP_SECRET } = process.env
if (!META_APP_SECRET) {
  throw new Error('Missing app secret in environment variables')
}

export const app = new Hono()

app.get('/', async (c) => {
  const response = await AI.respond({
    input: 'Write a short greeting to our user, with a few words.',
  })
  return c.text(response)
})

app.post('/webhook', async (c) => {
  const headerSignature = c.req.header('x-hub-signature-256')?.slice(7)
  if (!headerSignature) return c.status(401)

  const body = await c.req.text()

  const computedSignature = createHmac('sha256', META_APP_SECRET)
    .update(body)
    .digest('hex')

  if (computedSignature !== headerSignature) {
    return c.status(401)
  }

  const notificationDetails = WA.parseNotification(
    JSON.parse(body) as WA.Notification
  )
  if (!notificationDetails) {
    console.debug(chalk.yellow('Notification has no changes or status update'))
    return c.body('', 200)
  }

  if (notificationDetails.message) {
    const { businessPhoneNumberId, message } = notificationDetails
    console.debug(chalk.green(`${message.type} message`))
    console.debug(chalk.gray(body))
    await WA.markAsReadAndStartTyping(businessPhoneNumberId, message.id)

    switch (message.type) {
      case 'text':
        await handleTextMessage(businessPhoneNumberId, message)
        break
      case 'image':
        await handleImageMessage(businessPhoneNumberId, message)
        break
      case 'audio':
        await handleAudioMessage(businessPhoneNumberId, message)
        break
      case 'document':
        await handleDocumentMessage(businessPhoneNumberId, message)
        break
      default:
        await handleUnsupportedMessage(businessPhoneNumberId, message)
    }
  }

  if (notificationDetails.statusUpdate) {
    await handleStatusUpdate(notificationDetails.statusUpdate)
  }

  return c.body('', 200)
})

app.get('/webhook', function webhookVerificationRequest(c) {
  // https://developers.facebook.com/docs/graph-api/webhooks/getting-started#verification-requests
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
