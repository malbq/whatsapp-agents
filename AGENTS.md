# AGENTS guide for zapid

## Build/lint/test

- Dev: bun run dev (hot, :8080). Start: bun run start
- Typecheck: bun run typecheck
- Lint (oxc): bun run lint (auto-fix). Config: .oxlintrc.json
- Run one test file: bun test test/xyz.test.ts
- Run one test name: bun test -t "name substring"

## Tech stack

- Web framework: HonoJS v4 (worker-style router)
- LLM abstraction: Vercel AI SDK (ai package) over multiple providers
- External services: Meta Business API (WhatsApp), OpenAI Responses API, Google AI Studio
- Embeddings: Cloudflare Workers AI (generation), libsql vectors (storage)
- File storage: Cloudflare R2 (production), unstorage filesystem (dev)

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

- Frame-based pipeline (ECS-inspired, minimalist): per-request Frame holds ephemeral state (user, inbound, outbound); no global mutable state.
- Systems as focused async functions: (frame, deps, ...args) mutate only the Frame and use injected deps (PersistUser, IngestMessage, MessageEmbedding, ResponseGeneration, ResponseDelivery, MediaStorage, StoreMessageExchange, ImproveUserProfile).
- Phased flow:
  1. PersistUser ensures frame.user exists
  2. IngestMessage captures raw input & media
  3. Inbound MessageEmbedding enriches for retrieval/context
  4. ResponseGeneration produces outbound message
  5. ResponseDelivery sends answer (if this fails we stop)
  6. Post-response best-effort: parallel MediaStorage + outbound MessageEmbedding, then StoreMessageExchange, ImproveUserProfile.
- Error segmentation: three isolated try/catch blocks (generation, delivery, post-processing). Generation failure sets safe fallback outbound; delivery failure aborts tail; post tasks log only. Structured logging via logtape + spreadError.
- Dual embedding strategy: inbound first (context + future memory), outbound after delivery prep (memory/personalization). Failures do not block other phases.
- Logging context: withContext attaches userId for consistent structured logs across all systems.
- Extensibility: add new capabilities by inserting a new System in the flow or post-response list; keep Frame minimal & data-only.
- ECS note: simplified; Frame fields act as components; no registry/queries. Chosen for clarity & low overhead.
- Testing: Systems remain unit-testable (pure-ish) due to explicit deps + narrow mutable surface (Frame).

## Agent workflow hints

- Prompts live in src/prompts; prefer Responses API; keep tokens minimal; log usage via utils/formatTokenUsage.ts.
- When adding tests, mirror patterns in test/*.test.ts; keep focused, deterministic, and small.

## Test patterns

- Extract common setup into helpers (e.g. `createTestUser()`, `insertUserProfile()`)
- Create shared mock configurations in beforeAll/beforeEach
- Mock only chat and ai dependencies
- Use `test.each` for similar scenarios with different inputs
- When possible, use exact assertions: arrays, objects shapes, `toThrow(ErrorClass)`, `toThrow(/message/)`
- Clean database in afterEach with helper functions
- Keep describe blocks focused on single functionality areas
