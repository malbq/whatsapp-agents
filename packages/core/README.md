# Core Package (@batman/core)

Abstract building blocks for agents: database, storage, AI utilities, and first-class tools. Agents compose these primitives to implement their own pipelines and business logic.

## Overview

This package provides:

- AI utilities: embeddings, transcription, document/image analysis
- Infrastructure: database, storage, scheduler adapters
- First-class tools: web search/fetch, send text/reaction, etc.
- Utilities: HTTP fetch helpers, text processing, file handling

It does not expose any HTTP or WhatsApp-specific code. Agents own their pipelines and composition.

## Exports

This package is ESM-only and exposes module subpaths for clear boundaries:

- `@batman/core/ai/*` — AI helpers
  - `generateEmbeddings` — batch embedding with chunking
  - `transcribeAudio`, `transcribeDocument`, `analyzeImage`
- `@batman/core/infra/*` — Infra primitives
  - `db`, `dbPostgres` — DB interfaces and PostgreSQL implementation
  - `storage`, `storageFilesystem` — object storage interfaces and filesystem adapter (dev)
  - `scheduler`, `schedulerSystemd` — scheduler interfaces and systemd adapter (optional)
  - `webSearch`, `webSearchBrave` — web search interfaces and Brave implementation
- `@batman/core/tools/*` — First-class tools (for model tool-calling)
  - `webSearch`, `webFetch`, `sendText`, `sendReaction`, `search_conversation_history`
- `@batman/core/utils/*` — Utilities
  - `cloudflareFetch`, `sanitizeFilename`, `htmlToText`, `priorities`, etc.

Types are exported alongside each module (see source files for details). Prefer unknown over any and validate inputs with zod where applicable.

## Database and Migrations

- Baseline schema: user, message, embedding, raw_incoming_message, and supporting views/tables.
- Vectors: FLOAT32(384) with cosine similarity (indexed).
- Each agent owns its database lifecycle. Recommended order:
  1. Apply core baseline migrations
  2. Apply agent-specific extension migrations

From repository root:

- Run core baseline migrations: `bun --filter core db:migrate`

Note: keep core schema minimal and stable. Agents should add extension tables referencing core IDs when needed (e.g., `user_ext_<agent>`).

## Usage in Agents

- Compose these modules in your agent composition root.
- Persist inbound/outbound messages through infra/db.
- Generate/store embeddings through ai/generateEmbeddings and infra/dbPostgres.
- Use tools/\* for model tool-calling. The tools expect dependencies to be injected (no global state).

## Guidelines

- TypeScript strict; avoid any. Prefer unknown and precise types
- Small, focused functions; return early
- Avoid broad try/catch; let errors bubble up unless adding context
- No global mutable state; inject dependencies explicitly
- Keep tokens minimal in prompts; log usage where appropriate

## Environment

Typical env used by submodules (agents must provide them):

- Cloudflare AI: `CF_ACCOUNT_ID`, `CF_API_TOKEN`
- Brave Search (optional): `BRAVE_API_KEY`

## Examples

- Generate embeddings for texts:

```ts
import { generateEmbeddings } from '@batman/core/ai/generateEmbeddings'

const groups = await generateEmbeddings(['hello world'])
// groups is Array<Array<{ content, embedding }>> matching input order
```

- Web search tool in an agent:

```ts
import { createWebSearchTool } from '@batman/core/tools/webSearch'

const tool = createWebSearchTool({ webSearch }, 'Explain why searching helps here')
```

- Persist a message (PostgreSQL implementation example):

```ts
import { Postgres } from '@batman/core/infra/dbPostgres'

const db = Postgres.db({ url: process.env.DATABASE_URL! })
await db.storeMessage([
  {
    userId,
    type: 'text',
    modelMessage: { role: 'user', content: 'hi' },
    content: [{ content: 'hi', embedding: [] }],
  },
])
```

## Status

This package is intended to remain abstract and stable. Agents should rely on these primitives while keeping all agent-specific flows within their own packages.
