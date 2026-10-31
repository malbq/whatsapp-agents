# Warden Agent

Warden is a white-label WhatsApp business attendant that handles customer inquiries and appointment scheduling for any type of business. It serves as an always-available front desk: answering questions about the business and managing bookings through external calendar integrations.

## Initial Setup

1. Run `docker compose up -d` (from the monorepo root) to start the PostgreSQL container.
2. Connect to the database and create the database: `CREATE DATABASE warden;`.
3. Enable extensions: `CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS unaccent;`.
4. Copy `.env.example` to `.env` and fill in the values.
5. Run migrations: `bun run db:migrate`.

### Obtaining Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID (Web application type)
3. Add these redirect URIs:
   - `http://localhost:8080/auth/callback` (dashboard login)
   - `http://localhost:8080/api/calendar/callback` (calendar connection)
4. Enable the Google Calendar API in your project
5. Copy the Client ID and Client Secret to your environment variables

The calendar refresh token is now obtained through the dashboard UI (see Calendar Integration below).

## Overview

Warden is:

- **Single-tenant**: One deployment serves one business
- **Inbound-first**: Customers initiate conversations by messaging the business
- **Service-agnostic**: The code doesn't know or care what's being scheduled (medical appointments, legal consultations, tutoring sessions, etc.)
- **Calendar-integrated**: Scheduling happens through Google Calendar and/or Cal.com
- **Knowledge-grounded**: Answers are based on business-provided information

## Core Capabilities

1. **Answer Questions**: Respond to customer inquiries using the business's knowledge base
2. **Schedule Appointments**: Book, reschedule, and cancel appointments via calendar integrations
3. **Send Reminders**: Automated WhatsApp reminders before scheduled appointments
4. **Stay in Scope**: Politely decline requests outside its defined capabilities

## Architecture

Warden follows the established agent architecture pattern:

- **Composition root**: `index.ts` wires together `@wa/core`, `@wa/server`, and `@wa/whatsapp`
- **Webhook integration**: Uses `createWebhookApp()` from `@wa/whatsapp` with `app.route()`
- **Message processing**: Handles `Message` types from `@wa/whatsapp` directly
- **Core persistence**: Uses `@wa/core` DB/storage for message and knowledge base persistence
- **Calendar integration**: Pluggable adapters for Google Calendar and Cal.com
- **Scheduler**: Internal scheduler for WhatsApp appointment reminders

## Dashboard UI

The agent includes a web-based admin dashboard for business configuration and monitoring.

### Authentication

The dashboard uses Google OAuth for authentication. Users must sign in with a Google account to access protected routes.

**Configuration:**

- `DASHBOARD_SESSION_SECRET`: Required. A random string (32+ characters) used to sign session cookies.
- `DASHBOARD_REDIRECT_URI`: OAuth callback URL.

**Routes:**

- `/auth/login` - Login page with Google sign-in button
- `/auth/google` - Initiates Google OAuth flow
- `/auth/callback` - OAuth callback handler
- `/auth/logout` - Clears session and redirects to login
- `/settings` - Dashboard settings page (calendar connection, etc.)

All dashboard routes (like `/threads`, `/settings`) are protected and require authentication.

### Dashboard Features

- **Business Profile**: Configure business name, address, contact information
- **Operating Hours**: Set business hours for each day of the week
- **Services**: Define the services/appointment types offered (names and descriptions)
- **Knowledge Base**:
  - Structured fields for core business information
  - Free-form text editor for detailed content (FAQ, policies, service details)
- **Calendar Integration**: Configure Google Calendar and/or Cal.com credentials and settings
- **Persona**: Customize agent name and communication tone
- **Conversation History**: Read-only view of all customer conversations

Access the dashboard at `http://localhost:8080` (or your configured port).

## Available Tools

- `check_availability`: Query available appointment slots from connected calendars
- `book_appointment`: Create a new appointment booking
- `cancel_appointment`: Cancel an existing appointment
- `reschedule_appointment`: Change the date/time of an existing appointment
- `search_knowledge`: Search the business knowledge base for relevant information

## Conversation Flow

### Inquiry Flow

1. Customer sends a question via WhatsApp
2. Agent searches knowledge base for relevant information
3. Agent responds with grounded answer or politely indicates it doesn't have that information

### Booking Flow

1. Customer expresses interest in booking an appointment
2. Agent asks clarifying questions if needed (service type, preferences)
3. Agent checks availability and presents options
4. Customer selects a preferred slot
5. Agent confirms details and creates the booking
6. Agent sends confirmation message with appointment details

### Rescheduling Flow

1. Customer requests to reschedule an existing appointment
2. Agent retrieves the current appointment details
3. Agent checks availability and presents alternative options
4. Customer selects a new slot
5. Agent reschedules the appointment
6. Agent sends updated confirmation

### Cancellation Flow

1. Customer requests to cancel an appointment
2. Agent confirms the appointment to be cancelled
3. Agent cancels the booking
4. Agent sends cancellation confirmation

### Out-of-Scope Requests

When a customer asks for something outside Warden's capabilities:

1. Agent politely declines
2. Agent clarifies what it can help with (questions about the business, scheduling)

## Runtime Context

The agent has access to:

- Current date/time
- Business profile (name, address, contact, hours)
- Services offered
- Knowledge base content
- Connected calendar availability
- Customer information (phone number, name from WhatsApp)

## Calendar Integration

Warden connects to Google Calendar to manage appointments. The connection is established through the dashboard UI.

### Connecting Google Calendar

1. Log into the Warden dashboardTime
2. Go to `/settings`
3. Click "Connect Google Calendar"
4. Authorize Warden to access your Google Calendar
5. The connection is stored in the database and persists across restarts

The calendar connection stores a **refresh token** that allows Warden to make Calendar API calls on behalf of the business owner, even when they're not logged in. This enables:

- Checking availability when customers ask via WhatsApp
- Creating appointments when customers book
- Updating/canceling appointments

### Token Lifecycle

- **Refresh tokens are long-lived** and don't expire under normal use
- They can become invalid if:
  - User revokes access in Google Account settings
  - Token is unused for 6+ months
  - OAuth app is in "Testing" mode (tokens expire after 7 days)
- If the token becomes invalid, calendar operations will fail and the business owner needs to reconnect via the dashboard

### Google Calendar Features

- OAuth2 authentication via dashboard
- Query free/busy information
- Create, update, and delete calendar events
- Uses the primary calendar by default

## Reminders

Warden sends automated WhatsApp reminders before scheduled appointments:

- Default: 24 hours before appointment
- Uses internal scheduler (not delegated to calendar providers)
- Reminder includes appointment details and rescheduling instructions

## Future Enhancements (TODO)

- [ ] Human handoff: Connect customers to a human when agent can't help
- [ ] File uploads: Allow businesses to upload PDFs/documents to knowledge base
- [ ] Multiple calendar provider support: Use both Google Calendar and Cal.com simultaneously
- [ ] Configurable reminder timing: Let businesses set custom reminder intervals
- [ ] Outbound campaigns: Allow businesses to initiate conversations with customers
