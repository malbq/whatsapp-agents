# Agents in this monorepo

This repository is a monorepo containing multiple independently deployable AI agents and shared libraries. All code resides in `packages/`.

- **Agents** (deployable apps):
  - `packages/warden` (Recruitment agent)
  - `packages/zapid` (Personal assistant agent)
  - `packages/cmd` (Command agent)
- **Shared Libraries**:
  - `packages/core` (Abstract primitives: DB, AI, Tools)
  - `packages/server` (Hono server abstraction)
  - `packages/whatsapp` (WhatsApp Business API client)

This monorepo keeps shared packages abstract and agents self-contained. Each agent composes server, whatsapp, and core primitives to implement its own pipeline and deploy independently.

## Quick links

- Core package: packages/core/README.md
- Server package: packages/server/README.md
- WhatsApp package: packages/whatsapp/README.md
- Zapid agent: packages/zapid/README.md
- Warden agent: packages/warden/README.md
- CMD agent: packages/cmd/README.md

## Build, lint, typecheck

From the repo root:

- Typecheck all packages: `bun run typecheck`
- Lint all packages (oxc): `bun run lint` (auto-fix is enabled per package)

Each package also exposes its own scripts (see the package's README and package.json).

## Testing

Use Bun's test runner from the root. You can scope to names or files:

- Run one test file: `bun test ./test/xyz.test.ts`
- Run by name: `bun test -t "name substring"`
- Always use environment variable `AGENT=1` to run tests: `AGENT=1 bun test`

## Developing agents

- Start from an existing agent:
  - See `packages/warden` for a minimal example.
  - See `packages/zapid` for a full, complex pipeline.
- Compose `@wa/server` and `@wa/whatsapp` in your agent's composition root (`index.ts`).
- Persist and embed messages through `@wa/core`.
- **Strict Isolation**: Keep agent logic contained within the agent package. Systems, tools, prompts, and types must live inside the agent folder. Do not leak agent business logic into `packages/core`.

## Conventions (repo-wide)

- **TypeScript Strict**: Prefer `unknown` over `any`. Validate all external inputs with `zod`.
- **ESM Only**: Use ESM syntax. Group imports: std libs, third-party, internal.
- **Error Handling**: Let errors bubble up unless you are adding specific context. Avoid broad `try/catch` blocks that swallow errors.
- **State Management**: No global mutable state. Pass dependencies explicitly (Dependency Injection).
- **Control Flow**: Use small, focused functions. Return early instead of using `else`.
- **LLM Usage**: Keep tokens minimal in prompts; log token usage where appropriate.
- **Database Migrations**: Never manually edit SQL migration files or snapshot JSON files in `drizzle/` folders. Always use `bun drizzle-kit generate` to generate migrations from schema changes. Drizzle handles migration generation automatically.
- **Color functions**: Use CSS `color-mix` function to transform colors.

For agent-specific architecture, pipeline phases, and testing patterns, consult the corresponding agent README.
