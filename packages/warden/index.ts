import { createWebhookApp, createWhatsappClient } from '@batman/whatsapp'
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { ok } from 'node:assert'
import { createCalendarAdapter } from './calendar/googleCalendar'
import { dbFactory } from './db'
import { requireAuthApi } from './lib/authMiddleware'
import { processMessage } from './lib/processMessage'
import pkg from './package.json'
import dashboard from './ui/index.html'
import { createAuthRoutes } from './routes/auth.ts'
import { createAvailabilitySettingsRoute } from './routes/availabilitySettings.ts'
import { createCalendarAuthRoutes } from './routes/calendarAuth.ts'
import { createCalendarSettingsRoute } from './routes/calendarSettings.ts'
import { createClearMessagesRoute } from './routes/clearMessages.ts'
import { createServicesRoute } from './routes/services.ts'

ok(import.meta.env.META_WEBHOOK_VERIFY_TOKEN, 'META_WEBHOOK_VERIFY_TOKEN is required')
ok(import.meta.env.META_API_TOKEN, 'META_API_TOKEN is required')
ok(import.meta.env.META_APP_SECRET, 'META_APP_SECRET is required')
ok(import.meta.env.WA_BUSINESS_PHONE_ID, 'WA_BUSINESS_PHONE_ID is required')
ok(import.meta.env.DATABASE_URL, 'DATABASE_URL is required')
ok(import.meta.env.GOOGLE_CLIENT_ID, 'GOOGLE_CLIENT_ID is required')
ok(import.meta.env.GOOGLE_CLIENT_SECRET, 'GOOGLE_CLIENT_SECRET is required')
ok(import.meta.env.DASHBOARD_SESSION_SECRET, 'DASHBOARD_SESSION_SECRET is required')

const db = dbFactory()
const calendar = createCalendarAdapter(db)

const chat = createWhatsappClient({
  apiToken: import.meta.env.META_API_TOKEN,
  businessPhoneId: import.meta.env.WA_BUSINESS_PHONE_ID,
})

const webhookApp = createWebhookApp(
  chat,
  {
    appSecret: import.meta.env.META_APP_SECRET,
    verifyToken: import.meta.env.META_WEBHOOK_VERIFY_TOKEN,
  },
  { onMessage: processMessage({ db, chat, calendar }) }
)

const port = parseInt(import.meta.env.PORT || '8080')

const app = new Hono()
app.use(secureHeaders())
app.get('/health', (c) => c.text('OK'))

app.route('/webhook', webhookApp)
app.route('/auth', createAuthRoutes(db))
app.route('/api/calendar', createCalendarAuthRoutes(db))
app.route('/api/calendar', createCalendarSettingsRoute(db))
app.route('/api/availability', createAvailabilitySettingsRoute(db))
app.route('/api/services', createServicesRoute(db))

app.get('/api/session', requireAuthApi, (c) => {
  const session = c.get('session')
  return c.json({ session })
})

app.get('/api/threads', requireAuthApi, async (c) => {
  const threads = await db.listThreads()
  return c.json({ threads })
})

app.get('/api/threads/:userId', requireAuthApi, async (c) => {
  const userId = c.req.param('userId')
  const thread = await db.getThread(userId)
  if (!thread) {
    return c.json({ error: 'Thread not found' }, 404)
  }
  return c.json({ thread })
})

app.delete('/api/threads/:userId/messages', requireAuthApi, createClearMessagesRoute(db))

console.log(`Warden agent (${pkg.version}) starting on port ${port}`)

Bun.serve({
  port,
  development: import.meta.env.NODE_ENV !== 'production',
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
