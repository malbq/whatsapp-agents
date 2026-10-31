import { google } from 'googleapis'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { WardenDB } from '../db'
import { createOAuth2Client, type GoogleOAuthConfig } from '../lib/googleOAuth'
import { SESSION_COOKIE, type Session, type Sessions } from '../lib/session'

const STATE_COOKIE = 'oauth_state'
const NEXT_COOKIE = 'oauth_next'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar']

export interface AuthRoutesDeps {
  db: WardenDB
  sessions: Sessions
  oauth: GoogleOAuthConfig
  redirectUri: string
  secureCookies: boolean
}

function generateRandomString(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function createAuthRoutes({
  db,
  sessions,
  oauth,
  redirectUri,
  secureCookies,
}: AuthRoutesDeps) {
  const app = new Hono()
  const getOAuth2Client = () => createOAuth2Client(oauth, redirectUri)

  app.get('/login', (c) => {
    const error = c.req.query('error')
    const target = error ? `/login?error=${encodeURIComponent(error)}` : '/login'
    return c.redirect(target)
  })

  app.get('/google', (c) => {
    const state = generateRandomString()
    const next = c.req.query('next')

    setCookie(c, STATE_COOKIE, state, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'Lax',
      maxAge: 600,
      path: '/',
    })

    if (next) {
      setCookie(c, NEXT_COOKIE, next, {
        httpOnly: true,
        secure: secureCookies,
        sameSite: 'Lax',
        maxAge: 600,
        path: '/',
      })
    }

    const oauth2Client = getOAuth2Client()
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      state,
      prompt: 'consent',
    })

    return c.redirect(authUrl)
  })

  app.get('/callback', async (c) => {
    const code = c.req.query('code')
    const state = c.req.query('state')
    const storedState = getCookie(c, STATE_COOKIE)
    const errorParam = c.req.query('error')
    const next = getCookie(c, NEXT_COOKIE)

    deleteCookie(c, STATE_COOKIE, { path: '/' })
    deleteCookie(c, NEXT_COOKIE, { path: '/' })

    if (errorParam) {
      return c.redirect(`/login?error=${encodeURIComponent('Authentication cancelled')}`)
    }

    if (!code || !state || state !== storedState) {
      return c.redirect(`/login?error=${encodeURIComponent('Invalid authentication state')}`)
    }

    const oauth2Client = getOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()

    if (!userInfo.email) {
      return c.redirect(`/login?error=${encodeURIComponent('Could not retrieve email')}`)
    }

    if (tokens.refresh_token) {
      try {
        const calendarClient = google.calendar({ version: 'v3', auth: oauth2Client })
        const { data: calendarList } = await calendarClient.calendarList.list()
        const primaryCalendar = calendarList.items?.find((cal) => cal.primary)
        const calendarId = primaryCalendar?.id ?? 'primary'

        await db.saveCalendarConnection({
          refreshToken: tokens.refresh_token,
          calendarId,
          email: userInfo.email,
          connectedBy: userInfo.email,
        })
      } catch {
        console.error('Failed to save calendar connection - table may not exist')
      }
    }

    const session: Session = {
      email: userInfo.email,
      expiresAt: Date.now() + SESSION_DURATION_MS,
    }

    const token = await sessions.sign(session)

    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'Lax',
      maxAge: SESSION_DURATION_MS / 1000,
      path: '/',
    })

    const safeNext = next && next.startsWith('/') ? next : '/'
    return c.redirect(safeNext)
  })

  app.get('/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.redirect('/login')
  })

  return app
}
