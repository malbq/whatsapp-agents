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

- Composition root: `index.ts` wires together `@wa/server` and `@wa/whatsapp`
- Webhook integration: uses `createWebhookApp()` from `@wa/whatsapp`
- Command routing: simple pattern matching on message text
- No persistence: stateless command handler

## Available Commands

- `/help` - Show available commands
- `/text` - Test text message sending
- `/reaction` - Test emoji reaction
- `/contact` - Test contact card sending
- `/location` - Test location sharing
- `/list` - Test interactive list
- `/button` - Test interactive buttons
- `/cta` - Test interactive CTA URL button
- `/template` - Test template message
- `/flow` - Placeholder for flow messages

## Configuration

Required environment variables:

- `META_WEBHOOK_VERIFY_TOKEN` - Webhook verification token
- `META_API_TOKEN` - Meta API access token
- `META_APP_SECRET` - Meta app secret for signature validation
- `WA_BUSINESS_PHONE_ID` - WhatsApp Business Phone Number ID
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
