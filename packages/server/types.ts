import type { Hono, MiddlewareHandler } from 'hono'

export interface ServerBuilder {
  use: (middleware: ServerMiddleware) => ServerBuilder
  getApp: () => Hono<ServerEnv>
  build: () => { port: number; fetch: typeof Hono.prototype.fetch }
}

export type ServerEnv = {
  Variables: Record<string, unknown>
}

export interface ServerConfig {
  port: number
  name?: string
  version?: string
}

export type ServerMiddleware = MiddlewareHandler<ServerEnv>
