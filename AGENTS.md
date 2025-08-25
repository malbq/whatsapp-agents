# AGENTS guide for zapid

## Build/lint/test

- Dev: bun run dev (hot, :8080). Start: bun run start
- Typecheck: bun run typecheck
- Lint (oxc): bun run lint (auto-fix). Config: .oxlintrc.json
- Run one test file: bun test test/xyz.test.ts
- Run one test name: bun test -t "name substring"

## Style & conventions

- TypeScript strict; avoid any. Use zod for schemas. Prefer unknown over any.
- Names: single-word where clear. camelCase for vars/functions; PascalCase for types/classes; UPPER_SNAKE for const env keys.
- Imports: ESM only (package.json type: module). Use relative always. Group: std libs, third-party, internal. No wildcard barrel re-exports unless stable.
- Formatting: Prettier in editor; keep lines short and focused. No unused code. Keep functions small; inline trivial helpers.
- Control flow: avoid else; return early. Avoid try/catch; let errors bubble unless adding context.
- Errors: reuse src/errors.ts; throw Error with concise message; prefer Result-like returns only when needed. Log via config/logging.ts. No console.* in prod paths.
- Types: narrow with predicates; prefer readonly and const; use exact object shapes. Never silence with as any.
- Async: native fetch; Bun APIs over Node. No global mutable state; prefer param passing.
- Env: validate via src/utils/validateEnv.ts; run from project root so .env loads.
- Data/storage: libsql via infra/db.ts; vectors per infra/dbSetup/*.sql; files via storageFilesystem.ts/unstorage.

## Architecture patterns

- Entity-Component-System (ECS): Component-based architecture for separation of concerns
- Frame: Central ECS engine managing entities and components
- Systems: Specialized processors (ingestion, embedding, response generation)
- Components: Data-only structures for entity state

## Tech stack

- Web framework: HonoJS v4 (worker-style router)
- LLM abstraction: Vercel AI SDK (ai package) over multiple providers
- External services: Meta Business API (WhatsApp), OpenAI Responses API, Google AI Studio
- Embeddings: Cloudflare Workers AI (generation), libsql vectors (storage)
- File storage: Cloudflare R2 (production), unstorage filesystem (dev)

## Agent workflow hints

- Read spec first (.cursor/rules/spec-read.mdc); update spec per spec-update.mdc. Follow base.mdc style rules.
- Prompts live in src/prompts; prefer Responses API; keep tokens minimal; log usage via utils/formatTokenUsage.ts.
- When adding tests, mirror patterns in test/*.test.ts; keep focused, deterministic, and small.
