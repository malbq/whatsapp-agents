import { google } from 'googleapis'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { WardenDB } from '../db'

export interface Session {
  email: string
  expiresAt: number
}

export const SESSION_COOKIE = 'warden_session'
const STATE_COOKIE = 'oauth_state'
const NEXT_COOKIE = 'oauth_next'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar']

function generateRandomString(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function signToken(data: Session): Promise<string> {
  const payload = JSON.stringify(data)
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(import.meta.env.DASHBOARD_SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const signatureHex = Array.from(new Uint8Array(signature), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('')
  return `${Buffer.from(payload).toString('base64url')}.${signatureHex}`
}

async function verifyToken(token: string): Promise<Session | null> {
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [payloadB64, signatureHex] = parts
  if (!payloadB64 || !signatureHex) return null

  const payload = Buffer.from(payloadB64, 'base64url').toString('utf-8')
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(import.meta.env.DASHBOARD_SESSION_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )
  const signature = new Uint8Array(signatureHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)))
  const valid = await crypto.subtle.verify('HMAC', key, signature, encoder.encode(payload))
  if (!valid) return null

  const data = JSON.parse(payload) as Session
  if (data.expiresAt < Date.now()) return null

  return data
}

export async function getSession(cookie: string | undefined): Promise<Session | null> {
  if (!cookie) return null
  return verifyToken(cookie)
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    import.meta.env.GOOGLE_CLIENT_ID,
    import.meta.env.GOOGLE_CLIENT_SECRET,
    import.meta.env.DASHBOARD_REDIRECT_URI
  )
}

export function createAuthRoutes(db: WardenDB) {
  const app = new Hono()

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
      secure: import.meta.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 600,
      path: '/',
    })

    if (next) {
      setCookie(c, NEXT_COOKIE, next, {
        httpOnly: true,
        secure: import.meta.env.NODE_ENV === 'production',
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

    const token = await signToken(session)

    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      secure: import.meta.env.NODE_ENV === 'production',
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
