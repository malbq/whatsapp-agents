# Core Package (@wa/core)

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

- `@wa/core/ai/*` — AI helpers. Each is a factory that takes the model to use, so agents pick providers and tests can pass mock models.
  - `createGenerateEmbeddings({ model })` — batch embedding with chunking; `createCloudflareEmbeddingModel()` builds the Workers AI model
  - `createTranscribeAudio`, `createTranscribeDocument`, `createAnalyzeImage` — `({ model })`
  - `generateWhatsappMessage` — structured output constrained to WhatsApp message types
- `@wa/core/infra/*` — Infra primitives
  - `db`, `dbPostgres` — DB interfaces and PostgreSQL implementation
  - `storage`, `storageFilesystem` — object storage interfaces and filesystem adapter (dev)
  - `scheduler` — scheduler interfaces
  - `webSearch`, `webSearchBrave` — web search interfaces and Brave implementation
- `@wa/core/tools` — First-class tools (for model tool-calling)
  - `webSearch`, `webFetch`, `sendText`, `sendReaction`, `searchConversationHistory`, `searchFiles`
- `@wa/core/utils/*` — Utilities
  - `cloudflareFetch`, `sanitizeFilename`, `htmlToText`, `priorities`, `parsePdf`, etc.
- `@wa/core/errors` — Error handling utilities
- `@wa/core/testing` — Offline test doubles: recording `Chat`, mock language/embedding models, in-memory storage

Types are exported alongside each module (see source files for details). Prefer unknown over any and validate inputs with zod where applicable.

## Database and Migrations

- Baseline schema: user, message, embedding, raw_incoming_message, and supporting views/tables.
- Vectors: FLOAT32(768) with cosine similarity (indexed).
- Each agent owns its database lifecycle and migrations.

## Usage in Agents

- Compose these modules in your agent composition root.
- Persist inbound/outbound messages through infra/db.
- Generate/store embeddings through ai/generateEmbeddings and infra/dbPostgres.
- `Postgres.dbFactory` accepts any Drizzle Postgres client (Bun SQL in production, PGlite in tests).
- Use tools/\* for model tool-calling. The tools expect dependencies to be injected (no global state).

## Guidelines

- TypeScript strict; avoid any. Prefer unknown and precise types
- Small, focused functions; return early
- Avoid broad try/catch; let errors bubble up unless adding context
- No global mutable state; inject dependencies explicitly
- Keep tokens minimal in prompts; log usage where appropriate

## Configuration

This package never reads environment variables. Agents load and validate their config at startup and pass credentials, models and tuning options in explicitly.

## Examples

- Generate embeddings for texts:

```ts
import {
  createCloudflareEmbeddingModel,
  createGenerateEmbeddings,
} from '@wa/core/ai/generateEmbeddings'

const generateEmbeddings = createGenerateEmbeddings({
  model: createCloudflareEmbeddingModel({ accountId, apiToken }),
})
const groups = await generateEmbeddings(['hello world'])
// groups is Array<Array<{ content, embedding }>> matching input order
```

- Web search tool in an agent:

```ts
import { WebSearchBrave } from '@wa/core/infra/webSearchBrave'
import { createWebSearchTool } from '@wa/core/tools'

const webSearch = WebSearchBrave.createWebSearch({ apiKey })
const tool = createWebSearchTool({ webSearch })
```

- Persist a message (PostgreSQL implementation example):

```ts
import { Postgres } from '@wa/core/infra/dbPostgres'
import { drizzle } from 'drizzle-orm/bun-sql'

const client = drizzle(databaseUrl)
const db = Postgres.dbFactory({ client, options: { maxRecentMessages: 20 } })

await db.storeMessage([
  {
    userId: 'user-id',
    type: 'text',
    role: 'user',
    messages: [{ role: 'user', content: 'hi' }],
  },
])
```

## Status

This package is intended to remain abstract and stable. Agents should rely on these primitives while keeping all agent-specific flows within their own packages.
