# Tech Context

## Language

- **TypeScript** with `strict` mode enabled; no `any` type.

## Development Runtime

- **Bun** JS runtime
- `bun run dev` → `localhost:8080`
- Env vars from `.env`

## Production Runtime

- **Bun** JS runtime
- **HonoJS v4** – Worker-style router
- **Cloudflare Vectorize** (embeddings)
- **Cloudflare R2** (files)

## Architecture

- **Entity-Component-System (ECS)**: Component-based architecture for better separation of concerns
- **Frame**: Central ECS engine managing entities and components
- **Systems**: Specialized processors for different concerns (ingestion, embedding, response generation, etc.)
- **Components**: Data-only structures for entity state
