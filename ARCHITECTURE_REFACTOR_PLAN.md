# Architectural Refactor Plan

## 1) Context and Intent

Evolve the monorepo into an architecture where each agent in `packages/agent/*` is an independently deployable AI application. Cross-cutting concerns (web server bootstrap, WhatsApp Business integration, persistence, and base AI utilities) live in abstract packages that agents compose. Agents implement their own assistant behavior on top of these abstractions.

## 2) Snapshot of Current State (from repo tree)

- `server/` contains Hono/Bun server setup and middleware.
- `whastapp/` (typo) contains Meta WhatsApp integration and sample routes (chat/echo).
- `core/` contains infra (db, storage), systems (ingest, response generation, embeddings), and utilities.
- `packages/agent/` includes multiple agents: `default`, `frm`, and `zapid`.

Implication: most primitives exist; the refactor is primarily about hard boundaries, ownership, renames, and package extraction.

## 3) Updated Goals and Constraints

- Abstract packages: `server`, `whatsapp`, and `core`.
- Each agent is independent: its own DB, binary build, container image, and release cadence.
- Move part of message ingestion into `whatsapp` so agents receive normalized primitive events (text, image, audio/voice, document, reaction; delivery/read as optional). For image/document, `whatsapp` will hand off binary content (blob/buffer/stream) plus metadata to the agent.
- Agents rely on `core` to embed and persist messages.
- `whatsapp` receives all configuration and credentials from the agent (verify token, app secret, access token, number, base path, etc.).
- Schema/migrations: `core` provides a minimal baseline; agents extend via dedicated extension tables.
- No rollback, downtime, or backfill concerns (dev phase). Each agent starts clean on its own DB.
- Testing: only agent-level tests with the webserver abstracted; no unit tests for shared packages now.
- Observability (Axiom/Sentry) will be addressed later; keep light hooks only.
- Internal package scope: `@batman/*`.
- Keep work limited to this plan until approved.

## 4) Target Topology (packages and responsibilities)

- `packages/server` (abstract)

  - Hono/Bun server bootstrap + minimal middleware contracts (logging interface, error formatting interface, request id).
  - No provider/agent specifics and no WhatsApp code.

- `packages/whatsapp` (abstract)

  - Webhook routes factory (verification + inbound notifications) and signature validation.
  - Normalize inbound payloads to primitives: text, image, audio/voice, document, reaction; optionally delivery/read.
  - Provide binary payloads for image/document to the agent (buffer/blob/stream) with metadata and source ids.
  - Minimal outbound client for sending messages (text/media). No business rules.
  - All credentials and config injected by the agent at composition time.

- `packages/core` (abstract)

  - Database: baseline schema and migrations for user, thread/conversation, message, embedding.
  - Persistence + embeddings: utilities to save inbound/outbound messages and generate/store embeddings.
  - Base AI utility interfaces (LLM tools, embeddings, transcription) without provider lock-in.
  - Env validation and generic storage helpers. No HTTP/WhatsApp code.
  - Extensions via agent-owned tables (see section 6).

- `packages/agent/<name>` (deployable apps)
  - Composition root: assemble server, register WhatsApp routes, wire primitives into the ingestion pipeline, and start.
  - Business logic: pipeline, response generation, context management, and custom tools.
  - Persistence through `core` (including embeddings). Own DB lifecycle and migrations.
  - Builds to a binary and is packaged as a container. Released independently.

## 5) WhatsApp Ingestion and Primitive Events

- Primitive set (initial):
  - Text message
  - Image message (binary + url when available, mime, caption)
  - Audio/voice message (binary or url, mime, duration when available)
  - Document/PDF message (binary + url when available, mime, filename)
  - Reaction (emoji, target message id)
  - Delivery/read status (optional)
- Responsibilities in `whatsapp`:
  - Webhook verification and signature validation.
  - Normalize Meta payloads to the primitives above, with consistent metadata (sender, timestamps, source ids, thread hints).
  - For image/document/audio: provide binary content to the agent (buffer/blob/stream) when needed, with a safe size cap and metadata; allow agents to opt into "url-only" mode if desired.
  - Light dedup/idempotency hints based on Meta message ids; keep policy decisions in agents for now.
- Responsibilities in agents:
  - Persist primitives via `core` and trigger embeddings via `core`.
  - Execute the assistant pipeline and send outbound messages via the `whatsapp` client.

## 6) Data Model, Migrations, and Extensions

- Ownership: each agent has its own database. No shared DB, no backfill from current data.
- Baseline schema (conceptual): user, thread/conversation, message, embedding.
- Extensions: prefer agent-specific extension tables that reference base ids, e.g., `user_ext_<agent>`, `message_ext_<agent>` for additional columns and indexes. JSON blobs allowed only if an agent explicitly chooses, but the standard is extension tables.
- Migration composition: agents run `core` baseline first, then their extension migrations. Keep `core` minimal and stable.
- Embedding defaults TBD (research); agents can configure overrides through `core` interfaces once finalized.

## 7) Build and Deploy Strategy

- Build: use Bun to produce a single binary per agent (e.g., `bun build --compile`).
- Container: base the container on the existing Dockerfile pattern (see root Dockerfile: oven/bun:alpine multi-stage) and adapt per agent to run the binary. We can later optimize to a smaller base (e.g., distroless) if needed.
- Each agent publishes its own image and version independently.

## 8) Testing Strategy (agent-only)

- Only agent-level tests with the webserver abstracted (validate ingestion from primitives through to response and outbound send calls).
- No unit tests for `server`, `whatsapp`, or `core` for now.

## 9) Observability (later)

- Leave minimal hooks/interfaces for log/error capture, to be wired to Axiom (logs/metrics) and Sentry (errors) later.
- No provider integrations or dashboards in this phase.

## 10) Renames, Moves, and Ownership Clarifications

- Rename `whastapp/` → `packages/whatsapp/` (correct spelling) and migrate the WhatsApp-specific logic there.
- Move reusable server bootstrap from `server/` to `packages/server/` (abstract).
- Consolidate generic persistence, embedding, and transcription utilities into `packages/core/` (abstract, provider-agnostic).
- Move ALL of `packages/agent/default` into `packages/agent/zapid` now. Later, extract only truly generic pieces into `packages/core` when the boundaries become clear.

## 11) Phased Execution Plan (dev-friendly, no rollback)

Phase A — Preparation and Mapping

- Confirm `@batman/*` scope and align package.json workspaces.
- Map current modules to target packages (server bootstrap, WhatsApp parsing/sending, core persistence/embeddings).

Phase B — Package Scaffolding

- Create `packages/server`, `packages/whatsapp`, `packages/core` as abstract packages with minimal public surfaces (no provider coupling).

Phase C — WhatsApp Extraction and Normalization

- Move webhook verification and inbound handling into `packages/whatsapp`.
- Implement normalization to primitives and binary handoff for media (with size caps and metadata).
- Provide minimal outbound client for text/media sending; credentials injected by agents.

Phase D — Core Persistence and Embeddings

- Move embedding and message persistence utilities into `packages/core`.
- Publish baseline migrations for user/thread/message/embedding and helpers to run them.
- Define and document extension-table patterns for agent-specific schema.

Phase E — Server Bootstrap

- Move Hono/Bun bootstrap and middleware contracts into `packages/server`.
- Keep it minimal and agent-agnostic.

Phase F — Agent Composition and Moves

- Move all `agent/default` -> `agent/zapid`. Update composition to use `server`, `whatsapp`, and `core`.
- For other agents (`frm`, `zapid`): wire WhatsApp primitives into ingestion, persist/embed via `core`, and remove duplicated provider parsing.

Phase G — Build and Containerization

- Per agent: produce a single binary and adapt container based on current Dockerfile pattern.

Phase H — Agent Tests and Cleanup

- Implement agent tests (server abstracted) validating end-to-end ingestion/response.
- Remove deprecated paths and the old `whastapp/` location.

## 12) Open Points (to finalize later)

- Embeddings defaults (model and dimensionality) require research; finalize in `core` and allow per-agent overrides.
- Outbound delivery semantics (idempotency keys and retry policies) remain TBD; keep `whatsapp` outbound minimal for now.
