# WhatsApp Package

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
import { createWhatsappClient } from 'whatsapp'
import type { TextMessage, ImageMessage } from 'whatsapp'

const chat = createWhatsappClient({
  apiToken: 'your-meta-api-token',
  businessPhoneId: 'your-business-phone-id',
})

// Parse inbound webhooks
const { message, statusUpdate } = await chat.parseNotification(webhookBody)

// Incoming messages are fully typed
if (message?.type === 'text') {
  console.log(message.text) // TypeScript knows this exists
}

// Send messages using the same types
await chat.sendText({ text: 'Hello!' })
await chat.sendImage({ data: buffer, mimeType: 'image/jpeg' })
```

### Webhook Routes (Recommended)

The package provides a factory to create Hono routes with built-in signature validation and message handling:

```typescript
import { Hono } from 'hono'
import { createWhatsappClient, createWebhookRoutes } from 'whatsapp'

const app = new Hono()
const chat = createWhatsappClient({
  apiToken: process.env.META_API_TOKEN,
  businessPhoneId: process.env.META_BUSINESS_PHONE_ID,
})

createWebhookRoutes(app, chat, {
  appSecret: process.env.META_APP_SECRET,
  verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN,
}, {
  onMessage: async (message) => {
    // Handle incoming message
    console.log('Received message:', message)
    
    if (message.type === 'text') {
      await chat.sendText({ text: `Echo: ${message.text}` })
    }
  },
  onStatusUpdate: async (statusUpdate) => {
    // Optional: handle status updates (read, delivered, sent)
    console.log('Status update:', statusUpdate)
  },
  onUnknownNotification: async (body) => {
    // Optional: handle unknown notification types
    console.warn('Unknown notification:', body)
  }
})

export default {
  port: 8080,
  fetch: app.fetch,
}
```

The `createWebhookRoutes` function:
- Creates `GET /webhook` for Meta's verification request
- Creates `POST /webhook` for incoming notifications
- Validates HMAC-SHA256 signature automatically
- Parses notifications and routes to appropriate handlers
- Returns proper HTTP responses (200, 401, 403)

## Configuration

### WhatsApp Client (required, injected by caller)
- `apiToken`: Meta API access token
- `businessPhoneId`: WhatsApp Business Phone Number ID

### Webhook Routes (required, injected by caller)
- `appSecret`: Meta app secret for signature validation
- `verifyToken`: Token for webhook verification

### Optional (package env var)
- `WA_API_VERSION`: WhatsApp API version (defaults to `v23.0`)

## Message Types

The package uses a unified type system where the same message types are used for both incoming and outgoing messages:

### Base Message Types

All messages extend a base type with:
- `type`: Message type classification
- `replyingTo?`: Optional message ID to reply to

### Supported Message Types

- **TextMessage**: Simple text messages
  - `text`: Message text
- **ImageMessage**: Image messages
  - `data?`: Image binary data (ArrayBuffer)
  - `mimeType?`: Image MIME type
  - `caption?`: Optional caption
- **DocumentMessage**: Document/PDF messages
  - `data?`: Document binary data (ArrayBuffer)
  - `mimeType?`: Document MIME type
  - `filename?`: Document filename
  - `caption?`: Optional caption
- **VoiceMessage**: Voice note messages
  - `data?`: Audio binary data (ArrayBuffer)
  - `mimeType?`: Audio MIME type
- **AudioMessage**: Audio messages (non-voice)
  - `data?`: Audio binary data (ArrayBuffer)
  - `mimeType?`: Audio MIME type
- **LocationMessage**: Location sharing
  - `latitude`, `longitude`: Coordinates
  - `name?`, `address?`: Optional location details
- **ReactionMessage**: Emoji reactions
  - `emoji`: Emoji character
  - `externalChatId`: Message ID to react to
- **ContactMessage**: Contact cards
  - `name`: Contact name
  - `phone`: Phone number
- **InteractiveListMessage**: Interactive lists with sections
- **InteractiveButtonMessage**: Interactive buttons
- **InteractiveCtaUrlMessage**: Call-to-action URL buttons
- **TemplateMessage**: Message templates
- **UnsupportedMessage**: Unsupported message types
  - `unsupportedType?`: Original type string

### Incoming Messages

Incoming messages include routing metadata:

```typescript
type IncomingMessage = Message & {
  userExternalId: string  // WhatsApp ID
  userName: string        // User's display name
  externalId: string      // Message ID
}
```

### Outgoing Messages

For backward compatibility, the package also exports `Outgoing*Message` types:
- `OutgoingTextMessage` = `Omit<TextMessage, 'type'>`
- `OutgoingImageMessage` = `Omit<ImageMessage, 'type'>` (with required `data` and `mimeType`)
- `OutgoingDocumentMessage` = `Omit<DocumentMessage, 'type'>` (with required `data` and `mimeType`)
- etc.

These types omit the `type` field since it's implicit in the send method name.

## Client Interface

All outbound methods return a `Promise<string>` with the message ID:

- `parseNotification(body)`: Parse webhook payload
- `acknowledgeMessage(id)`: Mark message as read
- `sendText(params)`: Send text message
- `sendImage(params)`: Send image
- `sendDocument(params)`: Send document/PDF
- `sendLocation(params)`: Send location
- `sendReaction(params)`: Send emoji reaction
- `sendContact(params)`: Send contact card
- `sendInteractiveList(params)`: Send interactive list
- `sendInteractiveButton(params)`: Send interactive buttons
- `sendInteractiveCtaUrl(params)`: Send CTA URL button
- `sendTemplate(params)`: Send message template

## Architecture

The package maintains a clear separation between public API types and internal implementation:

- **types.ts**: Public API types exposed to agents
  - Unified message types (`TextMessage`, `ImageMessage`, etc.)
  - Message type union (`Message`)
  - Inbound message wrapper (`IncomingMessage`)
  - Backward-compatible outgoing types (`OutgoingTextMessage`, etc.)
  - Client interface (`Chat`)
- **whatsappTypes.ts**: Internal Meta WhatsApp Business API types (not exported)
  - Direct mappings of Meta's webhook payloads
  - Internal request/response structures
- **client.ts**: Factory function and client implementation
- **webhook.ts**: Webhook routes factory with signature validation
  - `createWebhookRoutes()`: Mounts GET/POST routes on Hono app
  - `validateWebhookSignature()`: HMAC-SHA256 signature validator (exported for custom implementations)
- **index.ts**: Package exports (only public types from types.ts)

Configuration is exposed through a closure pattern - the factory captures configuration in the closure, eliminating the need to pass it to every method call.

## API Reference

### Webhook Functions

#### `createWebhookRoutes(app, chat, config, handlers)`

Mounts webhook routes on a Hono app instance.

**Parameters:**
- `app`: Hono instance
- `chat`: WhatsApp client from `createWhatsappClient()`
- `config`: `{ appSecret, verifyToken }`
- `handlers`: `{ onMessage, onStatusUpdate?, onUnknownNotification? }`

**Routes created:**
- `GET /webhook` - Verification endpoint (returns challenge if valid)
- `POST /webhook` - Notification endpoint (validates signature, routes to handlers)

#### `validateWebhookSignature(body, signature, appSecret)`

Validates X-Hub-Signature-256 header.

**Parameters:**
- `body`: Raw request body (string)
- `signature`: Header value (with or without "sha256=" prefix)
- `appSecret`: Meta app secret

**Returns:** `boolean`
