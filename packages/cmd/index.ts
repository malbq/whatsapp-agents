import { createServer } from '@wa/server'
import { createWebhookApp, createWhatsappClient } from '@wa/whatsapp'
import { loadConfig } from './config'
import { createCommandHandler } from './handler'
import pkg from './package.json'

const config = loadConfig()

const chat = createWhatsappClient({
  apiToken: config.META_API_TOKEN,
  businessPhoneId: config.WA_BUSINESS_PHONE_ID,
  apiVersion: config.WA_API_VERSION,
})

const webhookApp = createWebhookApp(
  chat,
  { appSecret: config.META_APP_SECRET, verifyToken: config.META_WEBHOOK_VERIFY_TOKEN },
  { onMessage: createCommandHandler(chat) }
)

const { app, serve } = createServer({
  name: 'Command agent',
  version: pkg.version,
  port: config.PORT,
  development: config.NODE_ENV !== 'production',
})
app.route('/webhook', webhookApp)

serve()
