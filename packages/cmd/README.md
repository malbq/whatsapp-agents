# Command Agent

A simple demonstration and testing agent that handles WhatsApp commands without using AI. This agent implements command-based message routing for testing various WhatsApp message types.

## Overview

This agent:

- Listens for text messages starting with `/` (e.g., `/help`, `/text`, `/location`)
- Routes commands to appropriate WhatsApp message type handlers
- Does not use AI or persistence
- Intended for demonstration and testing purposes

## Architecture

Command agent follows the established agent architecture pattern:

- Composition root: `index.ts` loads config (`config.ts`) and wires together `@wa/server` and `@wa/whatsapp`
- Handler: `handler.ts` routes commands to `lib/command.ts`; covered by offline tests in `handler.test.ts`
- Webhook integration: uses `createWebhookApp()` from `@wa/whatsapp`
- Command routing: simple pattern matching on message text
- No persistence: stateless command handler

## Available Commands

- `/help` - Show available commands
- `/text` - Text message
- `/contact` - Contact card
- `/location` - Location pin
- `/list` - Interactive list
- `/button` - Interactive buttons
- `/cta` - Call-to-action URL button

## Configuration

Copy `.env.example` to `.env`. Variables are validated at startup (`config.ts`):

- `META_WEBHOOK_VERIFY_TOKEN` - Webhook verification token
- `META_API_TOKEN` - Meta API access token
- `META_APP_SECRET` - Meta app secret for signature validation
- `WA_BUSINESS_PHONE_ID` - WhatsApp Business Phone Number ID
- `WA_API_VERSION` - Graph API version (default: `v23.0`)
- `PORT` - Server port (default: 8080)

## Development

### Scripts

From the repo root:

- Typecheck: `bun run typecheck`
- Lint: `bun run lint`

Inside this package:

- `bun run typecheck`
- `bun run lint`
- `bun run dev` - Start development server

## Dependencies

- `@wa/server` - Server bootstrap and middleware
- `@wa/whatsapp` - WhatsApp Business API client

This agent does not use `@wa/core` as it does not require persistence or AI capabilities.
