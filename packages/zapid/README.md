# AI WhatsApp Assistant

**Codename: zapid**

A chat-based personal assistant for WhatsApp. Stores messages as semantic memory, retrieves files and history, searches the web, and gives contextual recommendations with a focus on privacy.

## Use Cases

- Store and retrieve documents
- Ask questions using personal context or web search
- Find nearby places, restaurants, businesses
- Get workout/diet plans, meal reminders, recipes
- Search and summarize web content

## Capabilities

- **Multimodal (Google Gemini)**: audio/voice, image, document
- **Semantic memory**: vector embeddings for similarity search
- **Conversational AI**: OpenAI GPT-5 Mini
- **Web search**: Brave Search with content extraction
- **Places**: Google Places with verified data and contact/location sharing
- **Files**: image and document storage and retrieval
- **Native WhatsApp features**: reactions, location, contacts
- **Privacy**: user profiles with explicit consent

## How It Works

1. Receive the message (text/media) via WhatsApp
2. Extract and understand multimodal content (audio/voice transcription, image analysis, document reading)
3. Automatically load profile and recent history into the conversation context
4. Decide actions: retrieve memories/files, search the web, query places, update profile
5. Generate and deliver the response with a safe fallback
6. Best-effort post-processing: memory storage (messages, media, embeddings) and profile enrichment

## Roadmap

### Next Priorities

- Better context retention with tool results in history
- Per-operation cost analysis: inference, embedding, web search, places, file storage, etc.
- Subscription plans and usage tracking
- LGPD compliance: encryption, explicit consent, terms of service and privacy policy, data export/deletion
- Observability: cost monitoring and alerts, metrics and logging
- Reliability: infrastructure redundancy, comprehensive tests, retry mechanisms, error handling

### Future Features

- Video ingestion
- TTS for audio replies
- Real-time conversation via [WhatsApp Cloud API Calling](https://developers.facebook.com/docs/whatsapp/cloud-api/calling)
- New tools:
  - Document generation (PDF, Word, Excel)
  - External storage integration (Google Drive, OneDrive, Dropbox)
  - Email inbox access
  - Image generation/editing

## Plans

> The plans below are not implemented; they are a product/pricing draft for the future.

### Free

- Model: GPT-5 Nano or an open-source model
- Messages per day: ~50
- Multimodal: Text only
- Memory: Recent history only
- Profile: No
- Files: No
- Tools: —

### Basic

- Model: GPT-5 Mini
- Messages per day: ~500
- Multimodal: Yes
- Memory: Profile + full history
- Files: Store and retrieve
- Tools: Web search, Google Places

### Pro

- Model: Premium of your choice
- Messages: Unlimited
- Multimodal: Video included
- Memory: Profile + full history
- Files: External storage integration
- Tools: Advanced (to be defined)

## Development and Stack

### Tech stack

- Web framework: HonoJS v4 (via the `@wa/server` package)
- LLM abstraction: Vercel AI SDK (`ai`) with multiple providers (OpenAI Responses + Google Gemini)
- External services: Meta Business API (WhatsApp), OpenAI Responses API, Google AI Studio
- Embeddings: Cloudflare Workers AI (generation) + vectors in PostgreSQL (`vector` extension / pgvector)
- File storage: `unstorage` filesystem (`FilesystemStorage`); Cloudflare R2 integration planned for production
- Scheduler: cron-based reminder support via the `@wa/core` package (Zapid-specific integration still in progress)

### Conventions

- Strict TypeScript; prefer `unknown` over `any`. Validate with zod
- ESM only; relative imports, grouped (std, third-party, internal)
- Small functions; return early instead of `else`
- Avoid broad `try/catch`; let errors propagate when possible
- No global mutable state; pass dependencies as parameters
- Variables/Types: `camelCase` for variables/functions; `PascalCase` for types/classes; `UPPER_SNAKE` for env

## Architecture and Flow

Zapid follows a pipeline built around a **Context** (ephemeral per-request state, kept in `AsyncLocalStorage`), with well-defined phases:

1. User setup (`index.ts`): `db.persistUser` creates or loads the user (including the latest saved profile) and loads their entitlements into `context`.
2. Message ingestion (`ingest.ts`): the WhatsApp notification is converted into a `DB.MessageInsert` via `toUserModelMessage`:
   - text is used directly
   - voice/audio is transcribed with Google Gemini
   - images and documents are deduplicated by hash and saved to `resource` + filesystem storage
   - the message is written to `message`, then embedded asynchronously by `embedInboundMessage` (images are analyzed; PDFs go through `parsePdf`, other documents through `transcribeDocument`).
3. Consent and quota (`checkUserConsent`, `entitlements`): users without consent receive the onboarding template and stop here; users over the daily message quota get a limit notice.
4. `responseGeneration` builds the agent context (current date/time, user profile, recent messages, system instructions) and calls the `gpt-5-mini-2025-08-07` model via Vercel AI SDK to generate a `GeneratedWhatsappMessage`.
5. Response delivery: `sendWhatsappMessage` sends the output through the WhatsApp client (`chat`) and populates `context.outbound` with the AI message and usage metadata.
6. Post-response (best‑effort): `storeAgentResponse` persists the outbound message and token usage; if `context.improvedProfile` exists, it writes a new version to `user_profile_version`.
7. Embeddings: `embedOutboundMessages` extracts text from the response, generates embeddings via Cloudflare Workers AI, and writes `snippet` rows for semantic search.

Characteristics:

- Tool-driven reasoning (via Vercel AI SDK + `@wa/core/tools` and local tools):
  - `search_conversation_history`
  - `search_files`
  - `web_search`
  - `web_fetch`
  - `google_places`
  - `send_reaction`
  - `update_user_profile`
- Side effects happen inside systems/tools (persistence, storage, web search), not in the core decision pipeline.
- Error segmentation:
  - response flow: on failure, we log and send the user a polite fallback
  - post-tasks: best‑effort; failures are logged and do not affect the user.
- Dual embedding strategy: input (current user message) + output (latest response), for future memory, personalization, and similarity search.
- Contextual logging with `userId`.
- Extensible: new systems/tools can be added without growing `Context` beyond what is needed.

## Code Structure

- `prompts/`: short, token-focused prompts (e.g. `system.ts`, `userProfile.ts`, `recentMessages.ts`)
- `systems/`: focused async functions that read/write `Context` via `getContext()`
  - Examples: `checkUserConsent.ts`, `responseGeneration.ts`, `storeAgentResponse.ts`, `embedInboundMessage.ts`, `embedOutboundMessages.ts`
- `tools/`: first-class tools called by the model
  - Agent-specific: `googlePlaces.ts`, `updateUserProfile.ts`
  - Generic (file/history search, reactions, web): exposed by `@wa/core/tools`
- `context.ts`: defines the `Context` type and per-request storage (`runContext` / `getContext`)
- `db.ts` / `dbSchema.ts`: reuses the base schema from `@wa/core` + agent-specific tables (`user_profile_version`, plans and entitlements)
- `zapid.d.ts`: agent helper types

## Database

- PostgreSQL with native vector support (`vector` extension / pgvector)
- Base tables inherited from `@wa/core`:
  - `user`, `message`, `token_usage`, `snippet`, `resource`, `reminder`, `raw_incoming_message`
- Zapid-specific tables:
  - `user_profile_version` (profile version history per user/message)
  - plans and entitlements (`plan`, `user_subscription`, `plan_entitlement`, `user_entitlement_override`, `user_entitlement_ledger`)
- Vectors: `vector(768)` with cosine similarity (indexed on `snippet.vector`)

### Initial Setup

1. Run `docker compose up -d` (at the monorepo root) to start the PostgreSQL container.
2. Connect to the server and create the database: `CREATE DATABASE zapid;`.
3. Enable the pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`.
4. Run the migrations:
   - `bun run --filter '@wa/agent-zapid' db:clean`
   - `bun run --filter '@wa/agent-zapid' db:generate`
   - `bun run --filter '@wa/agent-zapid' db:migrate`
   - `bun run --filter '@wa/agent-zapid' db:seed`

## Testing Tips

- Use Bun's runner; keep tests deterministic and small
- Mirror existing test patterns in `packages/core` and in `packages/zapid/agent.integration.test.ts` (`bun run test:integration`, requires Docker and API keys)
- Mock only chat and AI dependencies
- Prefer exact asserts: object/array shapes, `toThrow(ErrorClass)`, `toThrow(/message/)`
- Clean the database in `afterEach` with helpers (see `agent.integration.test.ts`)

## Build, lint, typecheck

From the repository root:

- Typecheck all packages: `bun run typecheck`
- Lint all packages (oxc): `bun run lint`

Scripts available inside the package:

- `bun run typecheck`
- `bun run lint`
