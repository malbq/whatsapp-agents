import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { getSession, SESSION_COOKIE, type Session } from '../routes/auth'

declare module 'hono' {
  interface ContextVariableMap {
    session: Session
  }
}

export const requireAuth = createMiddleware(async (c, next) => {
  const cookie = getCookie(c, SESSION_COOKIE)
  const session = await getSession(cookie)

  if (!session) {
    return c.redirect('/login')
  }

  c.set('session', session)
  return next()
})

export const requireAuthApi = createMiddleware(async (c, next) => {
  const cookie = getCookie(c, SESSION_COOKIE)
  const session = await getSession(cookie)

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  c.set('session', session)
  return next()
})
