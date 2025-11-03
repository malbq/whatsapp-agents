import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import type { ServerBuilder, ServerConfig, ServerEnv, ServerMiddleware } from './types'

export function createServer(config: ServerConfig): ServerBuilder {
  const app = new Hono<ServerEnv>()
  app.use(secureHeaders())

  const middlewares: ServerMiddleware[] = []

  const use = (middleware: ServerMiddleware): ServerBuilder => {
    middlewares.push(middleware)
    app.use(middleware)
    return builder
  }

  const getApp = (): Hono<ServerEnv> => {
    return app
  }

  const build = () => {
    app.get('/', (c) => c.text('OK'))

    return {
      port: config.port,
      fetch: app.fetch,
    }
  }

  const builder: ServerBuilder = {
    use,
    getApp,
    build,
  }

  return builder
}
