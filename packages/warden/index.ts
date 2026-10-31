import { createOpenAI } from '@ai-sdk/openai'
import { createWebhookApp, createWhatsappClient } from '@wa/whatsapp'
import { drizzle } from 'drizzle-orm/bun-sql'
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { createCalendarAdapter } from './calendar/googleCalendar'
import { loadConfig } from './config'
import { createWardenRepository } from './db'
import * as schema from './dbSchema'
import { createAuthMiddleware } from './lib/authMiddleware'
import type { GoogleOAuthConfig } from './lib/googleOAuth'
import { processMessage } from './lib/processMessage'
import { createSessions } from './lib/session'
import pkg from './package.json'
import dashboard from './ui/index.html'
import { createAuthRoutes } from './routes/auth.ts'
import { createAvailabilitySettingsRoute } from './routes/availabilitySettings.ts'
import { createCalendarAuthRoutes } from './routes/calendarAuth.ts'
import { createCalendarSettingsRoute } from './routes/calendarSettings.ts'
import { createClearMessagesRoute } from './routes/clearMessages.ts'
import { createServicesRoute } from './routes/services.ts'

const config = loadConfig()
const secureCookies = config.NODE_ENV === 'production'

const db = createWardenRepository(drizzle(config.DATABASE_URL, { schema }))
const oauth: GoogleOAuthConfig = {
  clientId: config.GOOGLE_CLIENT_ID,
  clientSecret: config.GOOGLE_CLIENT_SECRET,
}
const calendar = createCalendarAdapter(db, oauth)
const sessions = createSessions(config.DASHBOARD_SESSION_SECRET)
const auth = createAuthMiddleware(sessions)
const openai = createOpenAI({ apiKey: config.OPENAI_API_KEY })
const model = openai.responses('gpt-5-mini-2025-08-07')

const chat = createWhatsappClient({
  apiToken: config.META_API_TOKEN,
  businessPhoneId: config.WA_BUSINESS_PHONE_ID,
  apiVersion: config.WA_API_VERSION,
})

const webhookApp = createWebhookApp(
  chat,
  {
    appSecret: config.META_APP_SECRET,
    verifyToken: config.META_WEBHOOK_VERIFY_TOKEN,
  },
  { onMessage: processMessage({ db, chat, calendar, model }) }
)

const app = new Hono()
app.use(secureHeaders())
app.get('/health', (c) => c.text('OK'))

app.route('/webhook', webhookApp)
app.route(
  '/auth',
  createAuthRoutes({
    db,
    sessions,
    oauth,
    redirectUri: config.DASHBOARD_REDIRECT_URI,
    secureCookies,
  })
)
app.route(
  '/api/calendar',
  createCalendarAuthRoutes({
    db,
    auth,
    oauth,
    redirectUri: config.CALENDAR_REDIRECT_URI,
    secureCookies,
  })
)
app.route('/api/calendar', createCalendarSettingsRoute({ db, auth, oauth }))
app.route('/api/availability', createAvailabilitySettingsRoute(db, auth))
app.route('/api/services', createServicesRoute(db, auth))

app.get('/api/session', auth.requireAuthApi, (c) => {
  const session = c.get('session')
  return c.json({ session })
})

app.get('/api/threads', auth.requireAuthApi, async (c) => {
  const threads = await db.listThreads()
  return c.json({ threads })
})

app.get('/api/threads/:userId', auth.requireAuthApi, async (c) => {
  const userId = c.req.param('userId')
  const thread = await db.getThread(userId)
  if (!thread) {
    return c.json({ error: 'Thread not found' }, 404)
  }
  return c.json({ thread })
})

app.delete('/api/threads/:userId/messages', auth.requireAuthApi, createClearMessagesRoute(db))

console.log(`Warden agent (${pkg.version}) starting on port ${config.PORT}`)

Bun.serve({
  port: config.PORT,
  development: config.NODE_ENV !== 'production',
  // We explicitly list SPA routes here because Bun's HTMLBundle is supported
  // in Bun.serve({ routes }) but cannot be returned from fetch() as a Response.
  routes: {
    '/': dashboard,
    '/login': dashboard,
    '/threads': dashboard,
    '/chat/*': dashboard,
    '/calendar': dashboard,
    '/settings': dashboard,
    '/services': dashboard,
  },
  async fetch(req, _server) {
    const url = new URL(req.url)

    // Let Hono handle webhook, auth and API routes
    if (
      url.pathname === '/health' ||
      url.pathname.startsWith('/webhook') ||
      url.pathname.startsWith('/auth') ||
      url.pathname.startsWith('/api/')
    ) {
      return app.fetch(req)
    }

    // If a user deep-links to an unknown SPA route, send them to the root.
    const accept = req.headers.get('accept') ?? ''
    if (req.method === 'GET' && accept.includes('text/html')) {
      return Response.redirect('/', 302)
    }

    return new Response('Not Found', { status: 404 })
  },
})
