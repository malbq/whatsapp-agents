# Server Package (@batman/server)

Abstract server creator for creating Hono/Bun web servers with minimal middleware contracts.

## Overview

This package provides:

- Hono/Bun server bootstrap
- Minimal middleware contracts (logging, error formatting, request ID generation)
- No provider or agent specifics
- Single-step server creation with all parameters

## Usage

### Basic Server

```typescript
import { createServer } from '@batman/server'

const server = createServer({
  port: 8080,
  name: 'my-agent',
  version: '1.0.0',
})

export default {
  port: server.port,
  fetch: server.fetch,
}
```

### With Middleware

```typescript
import { createServer, createLoggingMiddleware } from '@batman/server'

const server = createServer({
  port: 8080,
  middlewares: [
    createLoggingMiddleware({
      logger: {
        debug: (message, context) => console.debug(message, context),
        info: (message, context) => console.info(message, context),
        warn: (message, context) => console.warn(message, context),
        error: (message, context) => console.error(message, context),
      },
      errorFormatter: {
        format: (error) => ({ message: error.message }),
      },
      requestIdGenerator: {
        generate: () => crypto.randomUUID(),
      },
    })
  ]
})
```

### With Sub-apps

```typescript
import { createServer } from '@batman/server'
import { Hono } from 'hono'

const webhookApp = new Hono()
webhookApp.post('/webhook', async (c) => {
  // Custom webhook logic
  return c.body('', 200)
})

const server = createServer({
  port: 8080,
  subApps: [
    { path: '/webhook', app: webhookApp }
  ]
})
```

### Composing with WhatsApp

```typescript
import { createServer, createLoggingMiddleware } from '@batman/server'
import { createWebhookApp } from '@batman/whatsapp'

const webhookApp = createWebhookApp(
  chat,
  {
    appSecret: process.env.META_APP_SECRET,
    verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
  },
  {
    onMessage: async (message) => {
      // Handle message
    },
  }
)

const server = createServer({
  port: 8080,
  middlewares: [createLoggingMiddleware()],
  subApps: [
    { path: '/webhook', app: webhookApp }
  ]
})
```

## API

### `createServer(config: ServerConfig): { port: number; fetch: typeof Hono.prototype.fetch }`

Creates a new server instance with all configuration provided upfront.

**Config:**

- `port: number` - Port to listen on
- `name?: string` - Optional server name
- `version?: string` - Optional server version
- `middlewares?: MiddlewareHandler[]` - Array of middleware to apply
- `subApps?: { path: string; app: Hono }[]` - Array of sub-apps to mount

**Returns:**

- `port: number` - The configured port
- `fetch: typeof Hono.prototype.fetch` - The fetch handler for the server

### `createLoggingMiddleware(config?: LoggingMiddlewareConfig)`

Creates logging middleware with customizable logger, error formatter, and request ID generator.

**Config:**

- `logger?: Logger` - Custom logger implementation
- `errorFormatter?: ErrorFormatter` - Custom error formatter
- `requestIdGenerator?: RequestIdGenerator` - Custom request ID generator

## Architecture

This package is designed to be abstract and composable:

- No WhatsApp-specific code
- No agent-specific logic
- No database or storage dependencies
- Minimal, focused responsibility: server bootstrap and middleware contracts
- Single-step creation pattern for simplicity

Agents compose this package with `@batman/whatsapp` and `@batman/core` to build complete applications.
