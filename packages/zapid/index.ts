import { FilesystemStorage } from '@wa/core/infra/storageFilesystem'
import { WebSearchBrave } from '@wa/core/infra/webSearchBrave'
import { createServer } from '@wa/server'
import { createWebhookApp, createWhatsappClient } from '@wa/whatsapp'
import * as Sentry from '@sentry/bun'
import { ok } from 'node:assert'
import { agent } from './agent'
import { runContext } from './context'
import { dbFactory } from './db'
import { ingest, isContentMessage } from './ingest'
import pkg from './package.json'
import { checkUserConsent } from './systems/checkUserConsent'
import { hasQuotaRemaining } from './systems/entitlements'
import { validatePlanCatalogue } from './systems/planCatalogue'
import { createChatRoute } from './ui/chat'

ok(import.meta.env.META_API_TOKEN, 'META_API_TOKEN is required')
ok(import.meta.env.META_WEBHOOK_VERIFY_TOKEN, 'META_WEBHOOK_VERIFY_TOKEN is required')
ok(import.meta.env.META_APP_SECRET, 'META_APP_SECRET is required')
ok(import.meta.env.WA_BUSINESS_PHONE_ID, 'WA_BUSINESS_PHONE_ID is required')

const apiToken = import.meta.env.META_API_TOKEN
const businessPhoneId = import.meta.env.WA_BUSINESS_PHONE_ID
const appSecret = import.meta.env.META_APP_SECRET
const verifyToken = import.meta.env.META_WEBHOOK_VERIFY_TOKEN

const db = dbFactory()
const chat = createWhatsappClient({ apiToken, businessPhoneId })
const storage = FilesystemStorage.storage('./storage')
const webSearch = WebSearchBrave.createWebSearch()

await validatePlanCatalogue(db).catch((e: Error) => {
  console.error(e.message)
  process.exit(1)
})

const webhookApp = createWebhookApp(
  chat,
  { appSecret, verifyToken },
  {
    onMessage: async (notification, raw) => {
      db.storeRawIncomingMessage(raw)
      const { message, userWaId, userName } = notification
      console.debug('Notification received', { notification })

      if (message.type === 'reaction') {
        console.debug('Skip reaction message')
        return
      }

      chat.acknowledgeMessage(message.messageWaId)

      const user = await db.persistUser({ waId: userWaId, name: userName })
      const entitlements = await db.getUserEntitlements({ userId: user.id })
      Sentry.setUser({ id: user.id, username: user.name, waId: user.waId })

      await runContext(
        { notification, db, storage, chat, webSearch, user, entitlements },
        async () => {
          const hasConsented = await checkUserConsent()
          console.debug('User identified', {
            user,
            hasConsented,
            features: entitlements.features,
            quotas: entitlements.quotas,
          })

          if (isContentMessage(message)) {
            // !flow-reply
            await ingest()
          }

          if (!hasConsented) return

          if (!hasQuotaRemaining('n_messages_per_day')) {
            console.warn('Message quota exceeded')
            // TODO send template message
            chat.sendText(userWaId, {
              text: '🤐 _Você atingiu o limite de mensagens de hoje._',
            })
            return
          }

          await agent()
        }
      )
    },
  }
)

const port = parseInt(import.meta.env.PORT || '8080')
const { app, serve } = createServer({ name: 'Zapid agent', version: pkg.version, port })
app.route('/webhook', webhookApp)
app.get('/chat', createChatRoute(db, storage))

serve()
