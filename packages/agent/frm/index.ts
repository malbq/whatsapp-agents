import { LibSql } from '@batman/core/infra/dbLibSql'
import { createServer } from '@batman/server'
import { createWebhookApp, createWhatsappClient } from '@batman/whatsapp'
import { ok } from 'node:assert'
import { processMessage } from './lib/processMessage'
import pkg from './package.json'
import { createCandidateRoutes } from './routes/candidates'
import { createClearMessagesRoute } from './routes/clearMessages'
import { dashboardRoute } from './routes/dashboard'
import { createDeleteInterviewRoute } from './routes/interviews'
import { createStartRoute } from './routes/start'
import { createThreadsRoute } from './routes/threads'

ok(import.meta.env.META_WEBHOOK_VERIFY_TOKEN, 'META_WEBHOOK_VERIFY_TOKEN is required')
ok(import.meta.env.META_API_TOKEN, 'META_API_TOKEN is required')
ok(import.meta.env.META_APP_SECRET, 'META_APP_SECRET is required')
ok(import.meta.env.WA_BUSINESS_PHONE_ID, 'WA_BUSINESS_PHONE_ID is required')
ok(import.meta.env.CF_ACCOUNT_ID, 'CF_ACCOUNT_ID is required')
ok(import.meta.env.CF_API_TOKEN, 'CF_API_TOKEN is required')
ok(import.meta.env.TEMPLATE_NAME, 'TEMPLATE_NAME is required')
ok(import.meta.env.OPENAI_API_KEY, 'OPENAI_API_KEY is required')
ok(import.meta.env.START_SECRET_TOKEN, 'START_SECRET_TOKEN is required')

const db = LibSql.db({ url: 'file:./storage/frm.db' })

const apiToken = import.meta.env.META_API_TOKEN
const businessPhoneId = import.meta.env.WA_BUSINESS_PHONE_ID
const chat = createWhatsappClient({ apiToken, businessPhoneId })

const appSecret = import.meta.env.META_APP_SECRET
const verifyToken = import.meta.env.META_WEBHOOK_VERIFY_TOKEN
const webhookApp = createWebhookApp(
  chat,
  { appSecret, verifyToken },
  { onMessage: processMessage({ db, chat }) }
)

const port = parseInt(import.meta.env.PORT || '8080')
const { app, serve } = createServer({ name: 'FRM agent', version: pkg.version, port })
app.route('/webhook', webhookApp)

// API routes for candidate CRUD
const candidateRoutes = createCandidateRoutes(db)
app.post('/api/candidates', candidateRoutes.create)
app.get('/api/candidates', candidateRoutes.list)
app.get('/api/candidates/:id', candidateRoutes.get)
app.put('/api/candidates/:id', candidateRoutes.update)
app.delete('/api/candidates/:id', candidateRoutes.delete)

// Dashboard routes
app.get('/', dashboardRoute)
app.get('/threads', createThreadsRoute(db))
app.get('/start', createStartRoute(db, chat))
app.delete('/api/threads/:userId/messages', createClearMessagesRoute(db))
app.delete('/api/interviews/:id', createDeleteInterviewRoute())

serve()
