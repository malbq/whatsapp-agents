import { expect, test, describe } from 'bun:test'
import { createServer } from './index'

describe('ServerBuilder', () => {
  test('creates server with basic config', () => {
    const server = createServer({
      port: 8080,
      name: 'test-server',
      version: '1.0.0',
    })

    expect(server).toBeDefined()
    expect(server.getApp()).toBeDefined()
  })

  test('builds server with port and fetch', () => {
    const server = createServer({ port: 3000 })
    const built = server.build()

    expect(built.port).toBe(3000)
    expect(built.fetch).toBeDefined()
    expect(typeof built.fetch).toBe('function')
  })

  test('adds middleware', () => {
    const server = createServer({ port: 8080 })
    const middleware = async (c: unknown, next: () => Promise<void>) => {
      await next()
    }

    const result = server.use(middleware)

    expect(result).toBe(server) // chainable
  })

  test('allows access to underlying Hono app', () => {
    const server = createServer({ port: 8080 })
    const app = server.getApp()

    app.get('/test', (c) => c.text('test'))

    expect(app).toBeDefined()
  })

  test('health check endpoint returns OK', async () => {
    const server = createServer({ port: 8080 })
    const built = server.build()

    const response = await built.fetch(new Request('http://localhost/'))

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('OK')
  })
})
