import type { Hono, MiddlewareHandler } from 'hono'

export interface ServerBuilder {
  use: (middleware: ServerMiddleware) => ServerBuilder
  getApp: () => Hono
  build: () => { port: number; fetch: typeof Hono.prototype.fetch }
}

export interface ServerConfig {
  port: number
  name?: string
  version?: string
}

export type ServerMiddleware = MiddlewareHandler
