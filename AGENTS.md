# Agents in this monorepo

This repository hosts multiple independently deployable AI agents under `packages/agent/*`, plus shared, abstract packages that agents compose.

- Agents (deployable apps): `packages/agent/<name>` (e.g., `frm`, `zapid`)
- Shared packages: `packages/core`, `packages/server`, `packages/whatsapp`

This monorepo keeps shared packages abstract and agents self-contained. Each agent composes server, whatsapp, and core primitives to implement its own pipeline and deploy independently.

## Quick links

- Zapid agent: packages/agent/zapid/README.md
- FRM agent: packages/agent/frm/README.md
- Server package: packages/server/README.md
- WhatsApp package: packages/whatsapp/README.md

## Build, lint, typecheck

From the repo root:

- Typecheck all packages: `bun run typecheck`
- Lint all packages (oxc): `bun run lint` (auto-fix is enabled per package)

Each package also exposes its own scripts (see the package's README and package.json).

## Testing

Use Bun's test runner from the root. You can scope to names or files:

- Run one test file: `bun test test/xyz.test.ts`
- Run by name: `bun test -t "name substring"`

## Developing agents

- Start from an existing agent (see `packages/agent/frm` for a minimal example, `packages/agent/zapid` for a full pipeline).
- Compose `@batman/server` and `@batman/whatsapp` in your agent's composition root (`index.ts`).
- Persist and embed messages through `@batman/core`.
- Keep agent logic contained within the agent package (systems, tools, prompts, and types live inside the agent folder).

## Conventions (repo-wide)

- TypeScript strict; prefer unknown over any. Validate inputs with zod.
- ESM only. Group imports: std libs, third-party, internal.
- Small, focused functions. Return early instead of else.
- Let errors bubble unless adding context. Avoid broad try/catch.
- No global mutable state; pass dependencies explicitly.
- Keep tokens minimal in prompts; log usage where appropriate.

For agent-specific architecture, pipeline phases, and testing patterns, consult the corresponding agent README.
