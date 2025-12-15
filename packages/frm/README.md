# FRM Agent - Recruitment Assistant

The FRM (Recruitment Management) agent is a specialized AI assistant designed to handle interview scheduling and recruitment processes for demonstration environments.

## Dashboard UI

The agent includes a simple web-based dashboard for managing candidates and viewing message threads:

- **Dashboard** (`/`): View all candidates and start conversation flows with a click
- **Message Threads** (`/threads`): Read-only view of all conversations with candidates

To access the dashboard, navigate to `http://localhost:8080` (or your configured port) in your browser.

### Dashboard Features

- View all candidates with their current flow status
- Start conversation flows with candidates directly from the UI (calls `/start` endpoint)
- View message history organized by user/candidate
- No realtime updates - refresh the page to see new messages

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

### Runtime Context

The agent assumes the following context is available at runtime:

- Current date/time
- Hiring company information: name, location, contact
- Recruitment manual/guidelines to ground responses

### Start Endpoint and Initial Message

- HTTP GET: `/start?phone={{phoneNumber}}`
- Sends WhatsApp template message `TEMPLATE_NAME` to `phoneNumber` with params: `name`, `position`
- Persists the outbound message as part of the agent conversation

### Detailed Scheduling Flow

1. Candidate receives the start template and opts in (positive response)
2. If negative: the agent sends a polite closing message
3. If positive:
   - Agent consults availability and presents options
   - Candidate chooses a date and time
   - Agent confirms the selected slot
   - Agent schedules the interview
   - Agent sends a confirmation message including rescheduling instructions

### Detailed Rescheduling Flow

1. Candidate requests to reschedule
2. Agent consults availability and presents options
3. Candidate chooses a new date and time
4. Agent confirms the selected slot
5. Agent reschedules the interview (cancel + schedule)
6. Agent sends a confirmation message including rescheduling information

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
