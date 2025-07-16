# System Patterns

## Architectural Overview

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
