import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { SESSION_COOKIE, type Session, type Sessions } from './session'

declare module 'hono' {
  interface ContextVariableMap {
    session: Session
  }
}

export type AuthMiddleware = ReturnType<typeof createAuthMiddleware>

export function createAuthMiddleware(sessions: Sessions) {
  /** Redirects anonymous visitors to the login page */
  const requireAuth = createMiddleware(async (c, next) => {
    const session = await sessions.getSession(getCookie(c, SESSION_COOKIE))

    if (!session) {
      return c.redirect('/login')
    }

    c.set('session', session)
    return next()
  })

  /** Answers anonymous API calls with 401 */
  const requireAuthApi = createMiddleware(async (c, next) => {
    const session = await sessions.getSession(getCookie(c, SESSION_COOKIE))

    if (!session) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    c.set('session', session)
    return next()
  })

  return { requireAuth, requireAuthApi }
}
