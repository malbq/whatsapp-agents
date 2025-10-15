# Project Brief

## Problem

People forget everyday details—spending, file locations, deadlines. Notes apps need manual organisation and rarely remind.

## Solution

Zapid Assistant is a chat-based personal secretary that:

- Retrieves memories and files.
- Answers questions.
- Sets reminders for specific times.

## How It Works

1. User sends message through whatsapp.
2. Assistant classifies intent: memory, reminder, or question.
3. Memory: store text, metadata, embeddings and media.
4. Reminders: schedule chat message at due time.
5. Questions: search personal store first, then web.

## Use Cases

- Remember or be reminded of anything.
- Store & retrieve documents.
- Ask generic questions.
- Get workout/diet plans, meal reminders, recipes.

## Goals

- Every message becomes memory.
- Personal context over generic data.
- Encrypted data at rest; nothing shared.
- Strictly productivity; no therapy roles.
- Minute-level reminders.
- Predictable costs by context tokens optimization.

## Scope

- Ingest text, audio, image, document.
- Semantic memory storage & retrieval.
- Reminder scheduling & delivery.
- Web search fallback.
- Data privacy controls (delete/export).

### Out of Scope

- Medical, therapy, or coaching advice.
- Image or music generation.
- Running undeclared external tools.
- Illegal activities.

## Development

### Versioning

The project uses automatic semantic versioning:

- Version is stored in `package.json`
- A git pre-commit hook automatically increments the patch version on every commit (unless manually changed)
- Docker images are tagged with the version from `package.json`
- The version is logged on application startup

To build and deploy with the current version:

```bash
bun run docker:build
docker compose up -d
```

To manually set a specific version, change it in `package.json` before committing. The pre-commit hook will detect the manual change and skip auto-increment.
