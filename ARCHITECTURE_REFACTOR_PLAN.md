# Architectural Refactor Plan

## Context and Intent

Evolve the monorepo into an architecture where each agent in `packages/agent/*` is an independently deployable AI application. Cross-cutting concerns (web server bootstrap, WhatsApp Business integration, persistence, and base AI utilities) live in abstract packages that agents compose. Agents implement their own assistant behavior on top of these abstractions.

## Current State

- `server/` contains Hono/Bun server setup and middleware.
- `whatsapp/` contains Meta WhatsApp integration and webhook routes builder.
- `core/` contains infra (db, storage), systems (ingest, response generation, embeddings), and utilities.
- `packages/agent/` includes multiple agents: `frm`, and `zapid`.

Implication: most primitives exist; the refactor is primarily about hard boundaries, ownership, renames, and package extraction.

## Goals and Constraints

- Abstract packages: `server`, `whatsapp`, and `core`.
- Each agent is independent: its own DB, binary build, container image, and release cadence.
- Agents rely on `core` to embed and persist messages.
- `whatsapp` receives all configuration and credentials from the agent (verify token, app secret, access token, number, base path, etc.).
- Schema/migrations: `core` provides a minimal baseline; agents extend via dedicated extension tables.
- No rollback, downtime, or backfill concerns (dev phase). Each agent starts clean on its own DB.
- Testing: only agent-level tests with the webserver abstracted; no unit tests for shared packages now.
- Observability (Axiom/Sentry) will be addressed later; keep light hooks only.

## Target Topology (packages and responsibilities)

- `packages/server` (abstract)

  - Hono/Bun server bootstrap + minimal middleware contracts (logging interface, error formatting interface, request id).
  - No provider/agent specifics and no WhatsApp code.

- `packages/whatsapp` (DONE)

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

## WhatsApp (DONE)

- Responsibilities in `whatsapp`:
  - Webhook verification and signature validation.
  - Light dedup/idempotency hints based on Meta message ids; keep policy decisions in agents for now.
- Responsibilities in agents:
  - Persist primitives via `core` and trigger embeddings via `core`.
  - Execute the assistant pipeline and send outbound messages via the `whatsapp` client.

## Data Model, Migrations, and Extensions

- Ownership: each agent has its own database. No shared DB, no backfill from current data.
- Baseline schema (conceptual): user, thread/conversation, message, embedding.
- Extensions: prefer agent-specific extension tables that reference base ids, e.g., `user_ext_<agent>`, `message_ext_<agent>` for additional columns and indexes. JSON blobs allowed only if an agent explicitly chooses, but the standard is extension tables.
- Migration composition: agents run `core` baseline first, then their extension migrations. Keep `core` minimal and stable.
- Embedding defaults TBD (research); agents can configure overrides through `core` interfaces once finalized.

## Build and Deploy Strategy

- Build: use Bun to produce a single binary per agent (e.g., `bun build --compile`).
- Container: base the container on the existing Dockerfile pattern (see root Dockerfile: oven/bun:alpine multi-stage) and adapt per agent to run the binary. We can later optimize to a smaller base (e.g., distroless) if needed.
- Each agent publishes its own image and version independently.

## Testing Strategy (agent-only)

- Only agent-level tests with the webserver abstracted (validate ingestion from primitives through to response and outbound send calls).
- No unit tests for `server`, `whatsapp`, or `core` for now.

## Open Points (to finalize later)

- Embeddings defaults (model and dimensionality) require research; finalize in `core` and allow per-agent overrides.
- Outbound delivery semantics (idempotency keys and retry policies) remain TBD; keep `whatsapp` outbound minimal for now.
