# WhatsApp Agents

A Bun + TypeScript monorepo of AI agents that run on the WhatsApp Business Cloud API, built on shared packages for the WhatsApp client, the HTTP server, AI helpers, storage and Postgres persistence.

> **Status: archived.** Meta's WhatsApp Business policy now forbids general-purpose AI assistants on the Business API, which rules out Zapid. Meta also launched its own Business AI agents, which covers Warden's use case. The code is kept as a portfolio reference. It is not maintained for production use.

## Agents

- **[Zapid](./packages/zapid/README.md)**: personal assistant. Multimodal input (voice, images, documents), long-term semantic memory over the conversation and files, web search/fetch, Google Places, user profile learning, per-plan quotas, and a consent onboarding flow. _README in Portuguese._
- **[Warden](./packages/warden/README.md)**: white-label front desk for a business. Answers questions from the business's knowledge base and books, reschedules or cancels appointments through Google Calendar. Includes a React dashboard for conversations, calendar, availability and services.
- **[CMD](./packages/cmd/README.md)**: AI-free command bot (`/text`, `/list`, `/button`, ...) for exercising every WhatsApp message type.

## Shared packages

- **[@wa/whatsapp](./packages/whatsapp/README.md)**: self-contained Cloud API client. Zod-validated webhook parsing, signature verification, unified incoming/outgoing message types, media upload/download.
- **[@wa/server](./packages/server/README.md)**: Hono/Bun server bootstrap with secure headers and health check.
- **[@wa/core](./packages/core/README.md)**: provider-agnostic building blocks. Structured WhatsApp message generation, transcription, image/document analysis, embeddings, Postgres repository with hybrid search (pgvector + full-text, fused with RRF), filesystem storage, and model tools (web search/fetch, history and file search, reactions).

Agents keep their own business logic, prompts, schema and migrations; shared packages stay generic.

## Stack

Bun, TypeScript 7 (strict), Hono, Vercel AI SDK 7 (OpenAI, Google Gemini), Zod 4, Drizzle ORM, PostgreSQL + pgvector, Cloudflare Workers AI (embeddings), Sentry, React 19 + TanStack Router + Tailwind 4 (Warden dashboard), oxlint.

## Getting started

```bash
bun install
bun run typecheck
bun run lint
bun run test           # offline: no network or API keys needed
```

Running an agent needs a WhatsApp Business app, provider API keys and a database:

```bash
docker compose up -d                        # Postgres 18 + pgvector on :5432
cp packages/zapid/.env.example packages/zapid/.env
cd packages/zapid && bun run db:migrate && bun run dev
```

Each agent has a `.env.example` listing its variables. Zapid's end-to-end suite runs against real models and the local database: `bun run test:integration` inside `packages/zapid`.

## Repository layout

```
packages/
  core/       shared AI, infra, tools and utils
  server/     HTTP server bootstrap
  whatsapp/   WhatsApp Cloud API client + webhook
  zapid/      personal assistant agent
  warden/     business front-desk agent + dashboard
  cmd/        command/demo agent
spec/         design notes written during development
```

See [AGENTS.md](./AGENTS.md) for conventions and contributor workflow.
