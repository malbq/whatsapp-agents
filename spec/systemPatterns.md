# System Patterns

## System Architecture

The system is a WhatsApp-based AI agent that processes multi-modal messages (text, audio, images, documents) and provides intelligent responses with memory, context, and tool capabilities. The architecture follows a slim Frame-based pipeline with four main layers:

1. **User Layer**: WhatsApp interface
2. **Meta Infrastructure**: Meta WAB Server and WhatsApp Pay
3. **Payment Layer**: Auth/Identity system with SQL user data storage
4. **Agent Layer**: Function-oriented processing pipeline where small systems mutate a per-request Frame

## Key Patterns

- **Frame-based Pipeline:** Per-request Frame mutated by small systems
- **Multi-Modal Processing:** Unified handling of text, audio, images, and documents through specialized ingestion systems
- **Context Orchestration:** Intelligent assembly of user profile, memory, chat history, and reminders
- **Persistent Storage:** Distributed storage across Chat History, Memory (vector), User Profile, and Object Store
- **Bi-directional Communication:** Inbound webhook processing and outbound reply delivery
- **Scheduled Operations:** Cron-based scheduler for reminder delivery
- **Tool-Oriented Reasoning:** LLM calls first-class tools (fetch_memory, search_files, send_file, web_search, web_fetch, google_places, send_reaction, update_user_profile) during response generation

```mermaid
graph TD
    subgraph "User"
        user[WhatsApp]
    end

    subgraph "Meta Infrastructure"
        wab[Meta WAB<br/>Server]
        pay[WhatsApp Pay]
    end

    subgraph "Payment"
        id[Auth<br/>Identity]
        userdb[User data<br/>SQL]
    end

    subgraph "Agent"
        wh[Webhook<br/>Listener]
        --> frame[Frame<br/>(per-request struct)]
        frame --> user[persistUser]
        frame --> ingest[ingestMessage]
        frame --> response[responseGeneration]
        response --> delivery[sendText]
        frame --> storage[storeMedia]
        frame --> embed[embedMessages]
        frame --> store[storeMessageExchange]
        frame --> profile[updateProfileVersionMessageId]

        ingest --> audio[ingestAudio]
        ingest --> voice[ingestVoice]
        ingest --> image[ingestImage]
        ingest --> document[ingestDocument]

        response --> chat[(Chat History)]
        response --> memory[(Memory)]
        response --> tools[(Tools: fetch_memory, search_files, send_file, web_search, web_fetch, google_places, send_reaction, update_user_profile)]

        delivery --> reply[Reply]
        reply --> cron[Scheduler]
    end

    user <-->|messages| wab
    user <-->|payments| pay
    pay -->|payment callbacks| id
    id --> userdb

    wab -->|webhook| wh
    reply --> wab
```

## Frame-based Processing Model

- Frame: per-request, data-only struct passed through the pipeline
- Systems: small, focused async functions that mutate only the Frame and use injected deps
- Tools: invoked during responseGeneration; side effects like sending messages or files happen inside systems/tools
- No registry or component model; keep data structures simple and explicit

## Code Architecture

The codebase follows Domain-Driven Design principles with unidirectional dependencies to ensure maintainability, testability, and extensibility. The architecture uses **parameter injection** for dependency management without external DI libraries.

### Layered Structure

- **Agent Layer** (`src/agent/`): Frame-based processing with focused systems and tools
- **Infrastructure Layer** (`src/infra/`): Concrete implementations of external services (WhatsApp, DB, AI, Storage)
- **Composition Root** (`src/index.ts`): Application startup and wiring of concrete infrastructure to systems

### Dependency Flow

```mermaid
graph TD
    subgraph "Layers"
        C[<strong>Composition Root</strong><br/><small>Wiring</small>]
        A[<strong>Agent Layer</strong><br/><small>Frame-based Systems</small>]
        I[<strong>Infrastructure Layer</strong><br/><small>Adapters (WhatsApp, DB, AI, Storage)</small>]
    end

    C --> A
    C --> I
    A --> I
```

## Database Schema

The database uses LibSQL with native vector support:

### Core Tables

- **user**: User profiles with external IDs and persistent profiles
- **message**: Message metadata with media storage keys
- **embedding**: Vector embeddings with content chunks
- **raw_incoming_message**: Raw webhook payloads for debugging

### Vector Support

- Native FLOAT32(384) vector type for embeddings
- Efficient similarity search using cosine distance
- Proper indexing for performance

## Error Handling

We avoid broad try/catch and let exceptions bubble to src/agent.ts:

- Generation: wrap ingestMessage + responseGeneration; on failure, send a concise fallback text
- Delivery: part of responseGeneration; same fallback path
- Post-processing: best-effort; log only, never affect UX
