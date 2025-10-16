# Progress

## Next

- **Fix**

  - Keep messages under 500 characters. Tell the agent in system prompt that it can use sendText as much as needed to split responses and send intermediate messages.
  - Agent should inform user with sendText of every action it performs with tools.
  - Every message must be stored in the database.

- **Loggingg**

  - Configure posthog in docker container

- **User Management**: Complete user management system

  - https://getlago.com/docs/welcome
  - Subscription plan management
  - Usage tracking and limits
  - Onboarding
  - Generate unique code or token link, bound to the phone number, for payment and configuration

- **Privacy & Compliance**: Data management features

  - Write Privacy policy
  - Write Terms of Service
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

- **Performance Optimization**:

  - Token budget management for large contexts
  - Embedding generation optimization
  - Database query optimization for vector search

## Future (after MVP)

- Encryption at rest
- TTS: Answer with audio message
- Cost Monitoring: Set up alerts for AI provider usage thresholds (e.g., via OpenAI dashboard hooks)
- Automated DB backups
- Media storage snapshots
- Real-time TTS
  - Requires interactive message with type `call_permission_request`
  - [WhatsApp Cloud API Calling](https://developers.facebook.com/docs/whatsapp/cloud-api/calling)

## Learnings & Insights

### WhatsApp

- WhatsApp templates required for proactive messages - otherwise 24h window to respond user initiated messages
- Users cannot edit messages in business chats
- Users can only delete messages for themselves in business chats
- [Cloud API does not notify about message deletion](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples#status--message-deleted)
- Cloud API does not notify when user is typing
- Registration:
  - Buy number
  - Verify number
  - Register phone number with account (via API)
  - Add webhook
  - Subscribe app to whatsapp account

### AI

- Model-specific configuration allows optimization for different tasks (text vs image vs audio)
- We must use specific model name/version
  - New models must be evaluated
  - Relying on default might disrupt experience
- OpenAI only opens URLs if `web_search_preview` is enabled; `gpt-4.1-nano` does not support `web_search_preview`.
- GPT-4.1 has 1M tokens context window, but degrades quite fast: https://openai.com/index/gpt-4-1/
- Gemini flash models are a lot faster than GPT at reading pdf files:
  - GPT-4o: got lost reading a pdf with flattened pages, reached a line where it started repeating the same text over and over again.
  - GPT 4o: 2m
  - GPT 4o mini: 2m
  - GPT 4.1 nano: 1m
  - Gemini 2.5 flash: 20s
  - Gemini 2.5 flash-lite: 10s
- Gemini flash models can only format output text if turning on thinking mode.
