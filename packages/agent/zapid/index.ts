import { FilesystemStorage } from '@batman/core/infra/storageFilesystem'
import { WebSearchBrave } from '@batman/core/infra/webSearchBrave'
import { createServer } from '@batman/server'
import { createWebhookApp, createWhatsappClient } from '@batman/whatsapp'
import { ok } from 'node:assert'
import { inspect } from 'node:util'
import { agent } from './agent'
import { runContext } from './context'
import { dbFactory } from './db'
import { ingest, isContentMessage } from './ingest'
import pkg from './package.json'
import { checkUserConsent } from './systems/checkUserConsent'
import { hasQuotaRemaining } from './systems/entitlements'
import { validatePlanCatalogue } from './systems/planCatalogue'

ok(import.meta.env.DATABASE_URL, 'DATABASE_URL is required')
ok(import.meta.env.META_API_TOKEN, 'META_API_TOKEN is required')
ok(import.meta.env.META_WEBHOOK_VERIFY_TOKEN, 'META_WEBHOOK_VERIFY_TOKEN is required')
ok(import.meta.env.META_APP_SECRET, 'META_APP_SECRET is required')
ok(import.meta.env.WA_BUSINESS_PHONE_ID, 'WA_BUSINESS_PHONE_ID is required')
ok(import.meta.env.CF_ACCOUNT_ID, 'CF_ACCOUNT_ID is required')
ok(import.meta.env.CF_API_TOKEN, 'CF_API_TOKEN is required')
ok(import.meta.env.OPENAI_API_KEY, 'OPENAI_API_KEY is required')
ok(import.meta.env.BRAVE_SEARCH_API_KEY, 'BRAVE_SEARCH_API_KEY is required')
ok(import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY, 'GOOGLE_GENERATIVE_AI_API_KEY is required')
ok(import.meta.env.GOOGLE_PLACES_API_KEY, 'GOOGLE_PLACES_API_KEY is required')
ok(import.meta.env.WA_ONBOARDING_TEMPLATE, 'WA_ONBOARDING_TEMPLATE is required')

const apiToken = import.meta.env.META_API_TOKEN
const businessPhoneId = import.meta.env.WA_BUSINESS_PHONE_ID
const appSecret = import.meta.env.META_APP_SECRET
const verifyToken = import.meta.env.META_WEBHOOK_VERIFY_TOKEN

const db = dbFactory()
const chat = createWhatsappClient({ apiToken, businessPhoneId })
const storage = FilesystemStorage.storage('./storage')
const webSearch = WebSearchBrave.createWebSearch()

await validatePlanCatalogue(db)

const webhookApp = createWebhookApp(
  chat,
  { appSecret, verifyToken },
  {
    onMessage: async (notification, raw) => {
      db.storeRawIncomingMessage(raw)
      const { message, userWaId, userName } = notification
      console.debug('[onMessage] Notification received', inspect(notification, { depth: null }))

      if (message.type === 'reaction') {
        console.debug('Skip reaction message', { userWaId })
        return
      }

      chat.acknowledgeMessage(message.messageWaId)

      const user = await db.persistUser({ waId: userWaId, name: userName })
      const entitlements = await db.getUserEntitlements({ userId: user.id })
      console.debug('[onMessage] User persisted', inspect(user, { depth: null }))

      await runContext(
        { notification, db, storage, chat, webSearch, user, entitlements },
        async () => {
          if (isContentMessage(message)) {
            await ingest()
          }

          const canRespond = await checkUserConsent()
          console.debug('[onMessage] Consent check result', { userWaId, canRespond })
          if (!canRespond) return

          if (!hasQuotaRemaining('n_messages_per_day')) {
            console.log('Message quota exceeded', { userWaId })
            // TODO send template message
            chat.sendText(userWaId, {
              text: '_Você atingiu o limite de mensagens de hoje._',
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

serve()
