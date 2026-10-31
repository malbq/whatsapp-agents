import { createServer } from '@wa/server'
import { createWebhookApp } from '@wa/whatsapp'
import { loadConfig } from './config'
import { createAgentDeps } from './deps'
import { createMessageHandler } from './handler'
import pkg from './package.json'
import { validatePlanCatalogue } from './systems/planCatalogue'
import { createChatRoute } from './ui/chat'

const config = loadConfig()
const deps = createAgentDeps(config)

await validatePlanCatalogue(deps.db)

const webhookApp = createWebhookApp(
  deps.chat,
  { appSecret: config.META_APP_SECRET, verifyToken: config.META_WEBHOOK_VERIFY_TOKEN },
  { onMessage: createMessageHandler(deps) }
)

const { app, serve } = createServer({
  name: 'Zapid agent',
  version: pkg.version,
  port: config.PORT,
  development: config.NODE_ENV !== 'production',
})
app.route('/webhook', webhookApp)
app.get('/chat', createChatRoute(deps.db, deps.storage))

serve()
