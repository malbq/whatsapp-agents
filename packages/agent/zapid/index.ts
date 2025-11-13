import { FilesystemStorage } from '@batman/core/infra/storageFilesystem'
import { WebSearchBrave } from '@batman/core/infra/webSearchBrave'
import { createServer } from '@batman/server'
import { createWebhookApp, createWhatsappClient } from '@batman/whatsapp'
import { ok } from 'node:assert'
import { agent } from './agent'
import { runContext } from './context'
import { dbFactory } from './db'
import pkg from './package.json'

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

const apiToken = import.meta.env.META_API_TOKEN
const businessPhoneId = import.meta.env.WA_BUSINESS_PHONE_ID
const appSecret = import.meta.env.META_APP_SECRET
const verifyToken = import.meta.env.META_WEBHOOK_VERIFY_TOKEN

const db = dbFactory()
const chat = createWhatsappClient({ apiToken, businessPhoneId })
const storage = FilesystemStorage.storage('./storage')
const webSearch = WebSearchBrave.createWebSearch()

const webhookApp = createWebhookApp(
  chat,
  { appSecret, verifyToken },
  {
    onMessage: async (notification, raw) => {
      db.storeRawIncomingMessage(raw)
      await runContext({ notification, db, storage, chat, webSearch }, async () => {
        await agent()
      })
    },
  }
)

const port = parseInt(import.meta.env.PORT || '8080')
const { app, serve } = createServer({ name: 'Zapid agent', version: pkg.version, port })
app.route('/webhook', webhookApp)

serve()
