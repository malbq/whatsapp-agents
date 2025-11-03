# Server Package

Abstract server builder for creating Hono/Bun web servers with minimal middleware contracts.

## Overview

This package provides:
- Hono/Bun server bootstrap
- Minimal middleware contracts (logging, error formatting, request ID generation)
- No provider or agent specifics
- Composable builder pattern for agents

## Usage

### Basic Server

```typescript
import { createServer } from 'server'

const server = createServer({
  port: 8080,
  name: 'my-agent',
  version: '1.0.0'
})

const app = server.build()

export default {
  port: app.port,
  fetch: app.fetch
}
```

### With Logging Middleware

```typescript
import { createServer, createLoggingMiddleware } from 'server'

const server = createServer({ port: 8080 })

server.use(createLoggingMiddleware({
  logger: {
    debug: (message, context) => console.debug(message, context),
    info: (message, context) => console.info(message, context),
    warn: (message, context) => console.warn(message, context),
    error: (message, context) => console.error(message, context)
  },
  errorFormatter: {
    format: (error) => ({ message: error.message })
  },
  requestIdGenerator: {
    generate: () => crypto.randomUUID()
  }
}))

const app = server.build()
```

### Adding Custom Routes

```typescript
import { createServer } from 'server'

const server = createServer({ port: 8080 })

const app = server.getApp()

app.get('/health', (c) => c.json({ status: 'ok' }))
app.post('/webhook', async (c) => {
  // Custom webhook logic
  return c.body('', 200)
})

const built = server.build()
```

### Composing with WhatsApp

```typescript
import { createServer, createLoggingMiddleware } from 'server'
import { createWebhookRoutes } from 'whatsapp'

const server = createServer({ port: 8080 })

server.use(createLoggingMiddleware())

const app = server.getApp()

createWebhookRoutes(app, chat, {
  appSecret: process.env.META_APP_SECRET,
  verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
  path: '/webhook'
}, {
  onMessage: async (message) => {
    // Handle message
  }
})

const built = server.build()
```

## API

### `createServer(config: ServerConfig): ServerBuilder`

Creates a new server builder instance.

**Config:**
- `port: number` - Port to listen on
- `name?: string` - Optional server name
- `version?: string` - Optional server version

### `ServerBuilder`

**Methods:**
- `use(middleware: ServerMiddleware): this` - Add middleware
- `getApp(): Hono<ServerEnv>` - Get underlying Hono app for custom routes
- `build()` - Build and return the server

### `createLoggingMiddleware(config?: LoggingMiddlewareConfig)`

Creates logging middleware with customizable logger, error formatter, and request ID generator.

**Config:**
- `logger?: Logger` - Custom logger implementation
- `errorFormatter?: ErrorFormatter` - Custom error formatter
- `requestIdGenerator?: RequestIdGenerator` - Custom request ID generator

## Types

### `Logger`

```typescript
interface Logger {
  debug: (message: string, context?: LogContext) => void
  info: (message: string, context?: LogContext) => void
  warn: (message: string, context?: LogContext) => void
  error: (message: string, context?: LogContext) => void
}
```

### `ErrorFormatter`

```typescript
interface ErrorFormatter {
  format: (error: unknown) => Record<string, unknown>
}
```

### `RequestIdGenerator`

```typescript
interface RequestIdGenerator {
  generate: () => string
}
```

## Architecture

This package is designed to be abstract and composable:

- No WhatsApp-specific code
- No agent-specific logic
- No database or storage dependencies
- Minimal, focused responsibility: server bootstrap and middleware contracts

Agents compose this package with `whatsapp` and `core` packages to build complete applications.
