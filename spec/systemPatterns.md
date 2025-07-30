# System Patterns

## System Architecture

The system is a WhatsApp-based AI agent that processes multi-modal messages (text, audio, images, documents) and provides intelligent responses with memory, context, and tool capabilities. The architecture follows an **Entity-Component-System (ECS)** pattern with four main layers:

1. **User Layer**: WhatsApp interface
2. **Meta Infrastructure**: Meta WAB Server and WhatsApp Pay
3. **Payment Layer**: Auth/Identity system with SQL user data storage
4. **Agent Layer**: ECS-based processing engine with specialized systems for different concerns

## Key Patterns

- **Entity-Component-System Architecture:** Component-based entities with specialized systems for different concerns
- **Multi-Modal Processing:** Unified handling of text, audio, images, and documents through specialized ingestion systems
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
        --> frame[Frame<br/>ECS Engine]
        frame --> receive[ReceiveMessage<br/>System]
        frame --> user[User<br/>System]
        frame --> ingest[Ingestion<br/>System]
        frame --> response[ResponseGeneration<br/>System]
        frame --> delivery[ResponseDelivery<br/>System]
        frame --> profile[ImproveUserProfile<br/>System]
        frame --> storage[MediaStorage<br/>System]
        frame --> embed[Embedding<br/>System]
        frame --> store[StoreMessageExchange<br/>System]

        ingest --> audio[AudioIngest<br/>System]
        ingest --> voice[VoiceIngest<br/>System]
        ingest --> text[TextIngest<br/>System]
        ingest --> image[ImageIngest<br/>System]
        ingest --> document[DocumentIngest<br/>System]

        response --> chat[(Chat History)]
        response --> memory[(Memory)]
        response --> profile[(User Profile)]
        response --> obj[(Object Store)]

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

## ECS Architecture

The system uses an Entity-Component-System pattern for better separation of concerns, testability, and extensibility:

### Core Components

- **Frame**: Central ECS engine managing entities and components
- **Components**: Data-only structures (Message, TextContent, Media, User, etc.)
- **Systems**: Logic processors that operate on entities with specific components

### Key Systems

- **ReceiveMessageSystem**: Processes incoming webhook messages
- **UserSystem**: Manages user creation and persistence
- **IngestionSystem**: Routes messages to appropriate content processors
- **ResponseGenerationSystem**: Generates AI responses with context
- **ResponseDeliverySystem**: Sends responses via WhatsApp
- **EmbeddingSystem**: Generates and stores vector embeddings
- **MediaStorageSystem**: Handles file storage and retrieval

### Component Types

```mermaid
graph TD
    subgraph "Message Components"
        Message[MessageComponent]
        TextContent[TextContentComponent]
        Media[MediaComponent]
        StoredMedia[StoredMediaComponent]
    end

    subgraph "Content Components"
        ImageContent[ImageContentComponent]
        DocumentContent[DocumentContentComponent]
        AudioContent[AudioContentComponent]
    end

    subgraph "Processing Components"
        VectorEmbedding[VectorEmbeddingComponent]
        ErrorComponent[ErrorComponent]
        User[UserComponent]
    end

    Message --> TextContent
    Message --> Media
    Message --> StoredMedia
    Media --> ImageContent
    Media --> DocumentContent
    Media --> AudioContent
    TextContent --> VectorEmbedding
    Message --> ErrorComponent
    Message --> User
```

## Code Architecture

The codebase follows Domain-Driven Design principles with unidirectional dependencies to ensure maintainability, testability, and extensibility. The architecture uses **parameter injection** for dependency management without external DI libraries.

### Layered Structure

- **Domain Layer** (`src/domain/`): Pure entities and types with no external dependencies
- **Agent Layer** (`src/agent/`): ECS-based processing with systems and components
- **Infrastructure Layer** (`src/infra/`): Concrete implementations of external services (WhatsApp, DB, AI, Storage)
- **Composition Root** (`src/index.ts`): Application startup and wires concrete infrastructure to features at runtime

### Dependency Flow

```mermaid
graph TD
    subgraph "Layers"
        C[<strong>Composition Root</strong><br/><small>Dependency Wiring</small>]
        A[<strong>Agent Layer</strong><br/><small>ECS Systems</small>]
        I[<strong>Infrastructure Layer</strong><br/><small>Abstract Ports and Concrete Adapters</small>]
        D[<strong>Domain Layer</strong><br/><small>Pure Entities</small>]
    end

    C --> A
    C --> I
    A --> D
    I --> D
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

The ECS architecture provides robust error handling:

- **Error Components**: Capture error state in entities
- **Error Delivery**: Convert error components to user-friendly messages
- **Graceful Degradation**: Continue processing even with partial failures
- **Isolation**: Errors in one system don't affect others
