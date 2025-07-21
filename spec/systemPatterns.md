# System Patterns

## System Architecture

The system is a WhatsApp-based AI agent that processes multi-modal messages (text, audio, images, documents) and provides intelligent responses with memory, context, and tool capabilities. The architecture consists of four main layers:

1. **User Layer**: WhatsApp interface
2. **Meta Infrastructure**: Meta WAB Server and WhatsApp Pay
3. **Payment Layer**: Auth/Identity system with SQL user data storage
4. **Agent Layer**: Core processing engine with message handling, storage, and AI capabilities

## Key Patterns

- **Event-Driven Architecture:** Webhook-triggered processing from Meta WAB Server
- **Multi-Modal Processing:** Unified handling of text, audio, images, and documents through specialized processors
- **Context Orchestration:** Intelligent assembly of user profile, memory, chat history, and reminders
- **Persistent Storage:** Distributed storage across Chat History, Memory (vector), User Profile, and Object Store
- **Bi-directional Communication:** Inbound webhook processing and outbound reply delivery
- **Scheduled Operations:** Cron-based scheduler for reminder delivery

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
        --> handler[Message<br/>Handler]
        handler <--> img[Image<br/>Analyser]
        handler <---> stt[Audio<br/>Transcriber]
        handler <----> doc[Document<br/>Parser]
        handler --> chat[(Chat History)]
        handler -->|embed| memory[(Memory)]
        handler -->|improve| profile[(User Profile)]
        handler -->|docs/imgs| obj[(Object Store)] --> reply
        memory--> context[Context<br/>Retriever]
        --> llm[LLM]
        --> reply[Reply]
        chat --> context
        profile --> context
        reply --> cron[Scheduler]
        cron --> context
    end

    user <-->|messages| wab
    user <-->|payments| pay
    pay -->|payment callbacks| id
    id --> userdb

    wab -->|webhook| wh
    reply --> wab
```

## Code Architecture

The codebase follows Domain-Driven Design principles with unidirectional dependencies to ensure maintainability, testability, and extensibility. The architecture uses **parameter injection** for dependency management without external DI libraries.

### Layered Structure

- **Domain Layer** (`src/domain/`): Pure entities and types with no external dependencies
- **Features Layer** (`src/features/`): Application use cases that depend on domain entities and receive infrastructure via parameters
- **Infrastructure Layer** (`src/infra/`): Concrete implementations of external services (WhatsApp, DB, AI, Storage)
- **Composition Root** (`src/index.ts`): Application startup and wires concrete infrastructure to features at runtime

### Dependency Flow

```mermaid
graph TD
    subgraph "Layers"
        C[<strong>Composition Root</strong><br/><small>Dependency Wiring</small>]
        F[<strong>Features Layer</strong><br/><small>Use Cases</small>]
        I[<strong>Infrastructure Layer</strong><br/><small>Abstract Ports and Concrete Adapters</small>]
        D[<strong>Domain Layer</strong><br/><small>Pure Entities</small>]
    end

    C --> F
    C --> I
    F --> D
    I --> D
```
