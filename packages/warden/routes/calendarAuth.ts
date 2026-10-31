import { google } from 'googleapis'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { WardenDB } from '../db'
import type { AuthMiddleware } from '../lib/authMiddleware'
import { createOAuth2Client, type GoogleOAuthConfig } from '../lib/googleOAuth'

const STATE_COOKIE = 'calendar_oauth_state'

// Calendar API scope - allows read/write access to calendar events
const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
]

function generateRandomString(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

export interface CalendarAuthRoutesDeps {
  db: WardenDB
  auth: AuthMiddleware
  oauth: GoogleOAuthConfig
  redirectUri: string
  secureCookies: boolean
}

export function createCalendarAuthRoutes({
  db,
  auth,
  oauth,
  redirectUri,
  secureCookies,
}: CalendarAuthRoutesDeps) {
  const app = new Hono()
  const getOAuth2Client = () => createOAuth2Client(oauth, redirectUri)

  // Start calendar OAuth flow
  app.get('/connect', auth.requireAuth, (c) => {
    const state = generateRandomString()

    setCookie(c, STATE_COOKIE, state, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'Lax',
      maxAge: 600,
      path: '/',
    })

    const oauth2Client = getOAuth2Client()
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline', // Required to get refresh token
      scope: CALENDAR_SCOPES,
      state,
      prompt: 'consent', // Force consent to always get refresh token
    })

    return c.redirect(authUrl)
  })

  // OAuth callback
  app.get('/callback', auth.requireAuth, async (c) => {
    const session = c.get('session')
    const code = c.req.query('code')
    const state = c.req.query('state')
    const storedState = getCookie(c, STATE_COOKIE)
    const errorParam = c.req.query('error')

    deleteCookie(c, STATE_COOKIE, { path: '/' })

    if (errorParam) {
      return c.redirect('/calendar?error=' + encodeURIComponent('Calendar connection cancelled'))
    }

    if (!code || !state || state !== storedState) {
      return c.redirect('/calendar?error=' + encodeURIComponent('Invalid authentication state'))
    }

    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      return c.redirect(
        '/calendar?error=' + encodeURIComponent('Could not get refresh token. Please try again.')
      )
    }

    // Get user email from the token
    oauth2Client.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()

    // Get list of calendars to find primary
    const calendarClient = google.calendar({ version: 'v3', auth: oauth2Client })
    const { data: calendarList } = await calendarClient.calendarList.list()
    const primaryCalendar = calendarList.items?.find((cal) => cal.primary)
    const calendarId = primaryCalendar?.id ?? 'primary'

    // Save to database
    await db.saveCalendarConnection({
      refreshToken: tokens.refresh_token,
      calendarId,
      email: userInfo.email ?? null,
      connectedBy: session.email,
    })

    return c.redirect('/calendar?success=' + encodeURIComponent('Calendar connected successfully'))
  })

  // Disconnect calendar
  app.post('/disconnect', auth.requireAuthApi, async (c) => {
    // Optionally revoke the token with Google
    const connection = await db.getCalendarConnection()
    if (connection) {
      const oauth2Client = getOAuth2Client()
      oauth2Client.setCredentials({ refresh_token: connection.refreshToken })
      await oauth2Client.revokeToken(connection.refreshToken).catch(() => {
        // Ignore errors - token might already be invalid
      })
    }

    await db.deleteCalendarConnection()

    return c.redirect('/calendar?success=' + encodeURIComponent('Calendar disconnected'))
  })

  // Get connection status (API endpoint)
  app.get('/status', auth.requireAuthApi, async (c) => {
    const connection = await db.getCalendarConnection()

    if (!connection) {
      return c.json({ connected: false })
    }

    return c.json({
      connected: true,
      email: connection.email,
      calendarId: connection.calendarId,
      connectedAt: connection.connectedAt.toISOString(),
      connectedBy: connection.connectedBy,
    })
  })

  return app
}
