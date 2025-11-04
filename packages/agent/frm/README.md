# FRM Agent - Recruitment Assistant

The FRM (Recruitment Management) agent is a specialized AI assistant designed to handle interview scheduling and recruitment processes for demonstration environments.

## Overview

This agent implements a complete recruitment workflow including:

- Interview slot management
- Candidate scheduling and tracking
- Automated reminders (24-hour before interviews)
- Interview result handling (approval/rejection)
- Persistent data storage in JSON format

## Architecture

FRM follows the established agent architecture pattern:

- Composition root: `index.ts` wires together `@batman/core`, `@batman/server`, and `@batman/whatsapp`
- Webhook integration: uses `createWebhookApp()` from `@batman/whatsapp` with `app.route()`
- Message processing: handles `Message` types from `@batman/whatsapp` directly (no custom wrapper)
- Core persistence: uses `@batman/core` DB/storage for message persistence
- Recruitment logic: in-memory data structures with JSON file persistence for FRM-specific state

## Data Persistence

The agent maintains state in `frm_data.json` with:

- Company information
- Interview slots and availability
- Candidate records
- Scheduled interviews
- Reminder timers

## Available Tools

- consult_schedule: Check available interview slots
- confirm_datetime: Verify a specific date/time availability
- schedule_interview: Schedule a candidate interview
- cancel_interview: Cancel a scheduled interview
- reschedule_interview: Change the date/time of an existing interview

## Recruitment Flow

1. Scheduling request: candidate expresses interest
2. Slot consultation: agent lists available slots
3. Confirmation: agent validates chosen date/time
4. Interview creation: interview scheduled with 24h reminder
5. Reminder delivery: automated reminder before interview
6. Result processing: handle approval/rejection outcomes

## Configuration

Company information is configured in the data store:

- Name: TechCorp
- Location: São Paulo, SP
- Contact: contato@techcorp.com.br

## Development

Designed for demonstration environments with:

- JSON file-based persistence
- In-memory data structures
- Simplified chat interface
- Minimal dependencies on the full pipeline

### Scripts

From the repo root:

- Typecheck: `bun run typecheck`
- Lint: `bun run lint`

Inside this package:

- `bun run typecheck`
- `bun run lint`

## Integration with Core Package

The FRM agent demonstrates what features are needed from `@batman/core`:

- AI response generation with tool calling
- Basic database and storage interfaces
- Chat abstraction for messaging

Missing features identified:

- Timer/scheduler system for reminders (currently in-memory only)
- More flexible data persistence abstractions
- Standardized tool creation patterns
