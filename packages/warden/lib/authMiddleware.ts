import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { getSession, SESSION_COOKIE, type Session } from '../routes/auth'

declare module 'hono' {
  interface ContextVariableMap {
    session: Session
  }
}

export async function requireAuth(c: Context, next: Next) {
  const cookie = getCookie(c, SESSION_COOKIE)
  const session = await getSession(cookie)

  if (!session) {
    return c.redirect('/login')
  }

  c.set('session', session)
  return next()
}

export async function requireAuthApi(c: Context, next: Next) {
  const cookie = getCookie(c, SESSION_COOKIE)
  const session = await getSession(cookie)

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('session', session)
  return next()
}
