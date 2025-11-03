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

- **Composition Root**: `index.ts` wires together core, server, and whatsapp packages
- **Webhook Integration**: Uses whatsapp `createWebhookApp()` with `app.route()` for message handling
- **Message Processing**: Processes whatsapp `Message` types directly (no custom IncomingMessage)
- **Core Persistence**: Uses core DB and storage for message persistence
- **Recruitment Logic**: In-memory data structures with JSON file persistence for FRM-specific state

## Data Persistence

The agent maintains state in `frm_data.json` with:

- Company information
- Interview slots and availability
- Candidate records
- Scheduled interviews
- Reminder timers

## Available Tools

### consult_schedule

Check available interview slots for scheduling.

### confirm_datetime

Verify if a specific date and time is available for interviews.

### schedule_interview

Schedule an interview for a candidate at a specific date and time.

### cancel_interview

Cancel a scheduled interview.

### reschedule_interview

Change the date/time of an existing interview.

## Recruitment Flow

1. **Scheduling Request**: Candidate expresses interest in scheduling
2. **Slot Consultation**: Agent shows available time slots
3. **Confirmation**: Agent confirms chosen date/time availability
4. **Interview Creation**: Interview is scheduled with 24h reminder
5. **Reminder Delivery**: Automated reminder sent before interview
6. **Result Processing**: Handle approval/rejection outcomes

## Configuration

Company information is configured in the data store:

- Name: TechCorp
- Location: São Paulo, SP
- Contact: contato@techcorp.com.br

## Development

The agent is designed to work in demonstration environments with:

- JSON file-based persistence
- In-memory data structures
- Simplified chat interface
- No complex pipeline dependencies

## Integration with Core Package

The FRM agent demonstrates what features are needed from the core package:

- AI response generation with tool calling
- Basic database and storage interfaces
- Chat abstraction for messaging

Missing features identified:

- Timer/scheduler system for reminders (currently in-memory only)
- More flexible data persistence abstractions
- Standardized tool creation patterns
