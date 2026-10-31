# WhatsApp Package (@wa/whatsapp)

Abstract, self-contained WhatsApp Business API client for agents.

## Overview

This package provides a factory function to create WhatsApp clients with injected configuration. It normalizes Meta's WhatsApp Business API payloads into unified message types that work for both incoming and outgoing messages.

**Key characteristics:**

- Zero dependencies on other monorepo packages (fully self-contained)
- Clean separation between public API and Meta's internal API types
- Configuration injection via factory pattern (no global state)
- **Unified message types** for both incoming and outgoing messages
- **Webhook routes factory** with built-in signature validation

## Usage

### Basic Client Usage

```typescript
import { createWhatsappClient } from '@wa/whatsapp'
// Note: Incoming message types are inferred or imported from 'types'

const chat = createWhatsappClient({
  apiToken: 'your-meta-api-token',
  businessPhoneId: 'your-business-phone-id',
})

// Parse inbound webhooks (returns a Promise<Notification | null>)
const notification = await chat.parseNotification(webhookBody)

if (notification && 'message' in notification) {
  const { message } = notification
  if (message.type === 'text') {
    console.log(message.text)
  }
}

// Send messages
await chat.sendText(userWaId, { text: 'Hello!' })
// Note: Binary data must be an ArrayBuffer
await chat.sendImage(userWaId, { data: buffer, mimeType: 'image/jpeg' })
```

### Webhook Routes (Recommended)

The package provides a factory to create Hono routes with built-in signature validation and message handling:

```typescript
import { Hono } from 'hono'
import { createWhatsappClient, createWebhookApp } from '@wa/whatsapp'

const app = new Hono()
const chat = createWhatsappClient({ apiToken, businessPhoneId, apiVersion: 'v23.0' })

const webhookApp = createWebhookApp(
  chat,
  { appSecret, verifyToken },
  {
    onMessage: async (notification, rawBody) => {
      // notification is of type MessageNotification
      const { message, userWaId, userName } = notification
      console.log(`Received ${message.type} from ${userName} (${userWaId})`)

      if (message.type === 'text') {
        await chat.sendText(userWaId, { text: `Echo: ${message.text}` })
      }
    },
    onStatusUpdate: async (statusNotification, rawBody) => {
      // Handle status updates (read, delivered, sent)
      console.log('Status update:', statusNotification.statusUpdate)
    },
    onUnknownNotification: async (rawBody) => {
      // Handle unknown notification types or parsing failures
      console.warn('Unknown notification:', rawBody)
    },
  }
)

// Mount the webhook app
app.route('/webhook', webhookApp)

export default {
  port: 8080,
  fetch: app.fetch,
}
```

The `createWebhookApp` function:

- Creates a Hono app with `GET /` for Meta's verification request
- Creates `POST /` for incoming notifications
- Validates the HMAC-SHA256 signature in `x-hub-signature-256` (constant-time compare)
- Parses notifications and routes to appropriate handlers
- Answers 200 right away and runs handlers in the background (errors are logged); invalid signatures get 401

## Configuration

### WhatsApp Client (required)

- `apiToken`: Meta API access token
- `businessPhoneId`: WhatsApp Business Phone Number ID
- `apiVersion` (optional): Graph API version, defaults to `v23.0`

The package reads no environment variables; pass everything in.

### Webhook Routes (required)

- `appSecret`: Meta app secret for signature validation
- `verifyToken`: Token for webhook verification

## Message Types

The package uses a unified type system.

### Base Message Types

All messages generally contain specific fields based on their `type`.

### Supported Message Types

- **Text**: `{ type: 'text', text: string }`
- **Image**: `{ type: 'image', data: ArrayBuffer, mimeType: string, caption?: string }`
- **Document**: `{ type: 'document', data: ArrayBuffer, mimeType: string, filename?: string, caption?: string }`
- **Audio/Voice**: `{ type: 'audio' | 'voice', data: ArrayBuffer, mimeType: string }`
- **Location**: `{ type: 'location', latitude: number, longitude: number, name?: string, address?: string }`
- **Reaction**: `{ type: 'reaction', emoji: string, targetMessageId: string }`
- **Contact**: `{ type: 'contacts', name: string, phone: string }`
- **Interactive List/Button/CTA**: Complex types for interactive messages
- **Template**: For sending approved templates

### Incoming Notifications

Incoming notifications are split into types like `MessageNotification` and `StatusUpdateNotification`.

```typescript
// MessageNotification
{
  userWaId: string
  userName: string
  userPhone: string
  timestamp: Date
  message: IncomingMessage // (text, image, audio, etc.)
}

// StatusUpdateNotification
{
  userWaId: string
  userName: string
  userPhone: string
  timestamp: Date
  statusUpdate: {
    id: string
    status: 'sent' | 'delivered' | 'read' | 'failed'
    // ...
  }
}
```

## Client Interface (`Chat`)

All outbound methods return a `Promise<string>` with the message ID.

- `parseNotification(body)`: Parse webhook payload
- `acknowledgeMessage(id)`: Mark message as read
- `sendTypingIndicator(id)`: Send a typing indicator
- `sendText(userId, message)`: Send text message
- `sendImage(userId, message)`: Send image
- `sendDocument(userId, message)`: Send document/PDF
- `sendLocation(userId, message)`: Send location
- `sendReaction(userId, message)`: Send emoji reaction
- `sendContact(userId, message)`: Send contact card
- `sendInteractiveList(userId, message)`: Send interactive list
- `sendInteractiveButton(userId, message)`: Send interactive buttons
- `sendInteractiveCtaUrl(userId, message)`: Send CTA URL button
- `sendTemplate(userId, message)`: Send message template

## Architecture

The package maintains a clear separation between public API types and internal implementation:

- **types.ts**: Public API types exposed to agents
- **whatsappTypes.ts**: Internal Meta WhatsApp Business API types (not exported)
- **client.ts**: Factory function and client implementation
- **webhook.ts**: Webhook routes factory with signature validation
- **index.ts**: Package exports

## API Reference

### Webhook Functions

#### `createWebhookApp(chat, config, handlers)`

Creates a Hono app with webhook routes.

**Parameters:**

- `chat`: WhatsApp client instance
- `config`: `{ appSecret, verifyToken }`
- `handlers`: `{ onMessage, onStatusUpdate?, onUnknownNotification? }`
  - `onMessage`: `(notification: MessageNotification, raw: string) => void`
  - `onStatusUpdate`: `(notification: StatusUpdateNotification, raw: string) => void`

**Returns:** Hono app instance

**Routes created:**

- `GET /` - Verification endpoint
- `POST /` - Notification endpoint
