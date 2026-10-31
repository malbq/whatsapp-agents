# Server Package (@wa/server)

Abstract server creator for creating Hono/Bun web servers.

## Overview

This package provides:

- Hono/Bun server bootstrap
- Default secure headers
- Health check endpoint (`/health`)
- Simple entry point for agents

## Usage

### Basic Server

```typescript
import { createServer } from '@wa/server'

const server = createServer({
  port: 8080,
  name: 'my-agent',
  version: '1.0.0',
})

// Starts the Bun server
server.serve()
```

### Customizing the App

You can access the underlying Hono instance via `server.app` to add middleware or routes before starting the server.

```typescript
import { createServer } from '@wa/server'

const server = createServer({
  port: 8080,
  name: 'my-agent',
  version: '1.0.0',
})

// Add custom middleware or routes
server.app.use(async (c, next) => {
  console.log(`[${c.req.method}] ${c.req.url}`)
  await next()
})

server.app.get('/custom', (c) => c.text('Custom route'))

server.serve()
```

## API

### `createServer(config: ServerConfig)`

Creates a new server instance.

**Config:**

- `name: string` - Server name (for logging startup)
- `version: string` - Server version (for logging startup)
- `port: number` - Port to listen on
- `development?: boolean` - Bun development mode with detailed error pages (default: `false`)

**Returns:**

- `app: Hono` - The configured Hono instance
- `serve: () => void` - Function to start the Bun server

## Architecture

This package is designed to be abstract and simple:

- No WhatsApp-specific code
- No agent-specific logic
- No database or storage dependencies
- Single-step creation pattern

Agents compose this package with `@wa/whatsapp` and `@wa/core` to build complete applications.
