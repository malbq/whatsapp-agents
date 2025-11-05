import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'

export interface ServerConfig {
  name: string
  version: string
  port: number
}

export function createServer(config: ServerConfig): {
  app: Hono
  serve: () => void
} {
  const app = new Hono()

  app.use(secureHeaders())

  app.get('/health', (c) => c.text('OK'))

  return {
    app,
    serve() {
      console.log(`${config.name} (${config.version}) starting on port ${config.port}`)
      Bun.serve({
        port: config.port,
        fetch: app.fetch,
      })
    },
  }
}
