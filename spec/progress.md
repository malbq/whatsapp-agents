# Progress

## Next

- **Tool Integration**: Implement tools

  - `search_file` and `retrieve_file` tools for file access
  - `create_reminder` and `cancel_reminder` tools
  - Tool execution system in agent workflow
  - Transform profile update in a tool

- **Scheduler System**: Implement reminder functionality

  - Manual schedule management
  - Test schedule triggering
  - Add schedule to context

- **User Management**: Complete user profile system

  - Subscription plan management
  - Usage tracking and limits

- **Privacy & Compliance**: Data management features

  - Privacy controls and onboarding through WhatsApp custom messages
  - Privacy policy notice and TOS acceptance in first interaction
  - Data export functionality
  - Data deletion for GDPR compliance
  - Data redacting in logs and error messages

- **Performance & Reliability**: System improvements

  - E2E tests for error scenarios, privacy flows, and rate limits
  - Retry mechanisms
  - Improved error handling

## Open Questions

- **Similar Messages Context**:

  - Should we add full messages that match vector search?
  - What if we match a document? Should we add at most a single document?

- **Tool Execution Strategy**:

  - How to integrate tool calls into the ECS architecture?
  - Should tools be separate systems or integrated into response generation?

- **Performance Optimization**:
  - Token budget management for large contexts
  - Embedding generation optimization
  - Database query optimization for vector search

## Future (after MVP)

- TTS: Answer with audio message
- Cost Monitoring: Set up alerts for AI provider usage thresholds (e.g., via OpenAI dashboard hooks)
- Automated DB backups
- Media storage snapshots

## Learnings & Insights

- WhatsApp templates required for proactive messages; otherwise 24h window to respond user initiated messages
- Users cannot edit messages in business chats
- Users can only delete messages for themselves in business chats
- [Cloud API does not notify about message deletion](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples#status--message-deleted)
- GPT-4.1 has 1M tokens context window, but degrades quite fast: https://openai.com/index/gpt-4-1/
- OpenAI only opens URLs if `web_search_preview` is enabled; `gpt-4.1-nano` does not support `web_search_preview`.
- We must use specific model name/version; new models must be evaluated; relying on default might disrupt experience.
- Model-specific configuration allows optimization for different tasks (text vs image vs audio)
- Gemini flash models are a lot faster than GPT reading pdf files:
  - GPT-4o: got lost reading a pdf with flattened pages, reached a line where it started repeating the same text over and over again.
  - GPT 4o: 2m
  - GPT 4o mini: 2m
  - GPT 4.1 nano: 1m
  - Gemini 2.5 flash: 20s
  - Gemini 2.5 flash-lite: 10s
- Gemini flash models can only format output text if turning on thinking mode.
