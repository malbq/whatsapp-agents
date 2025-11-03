# Progress

## Next

- We need to keep tool results in context, alongside messages

  - For example, if user follow-up with a question after a web search, we currently only know about agent messages. Search results were discarded. That would cause agent to search again, spending more tokens and time.
  - Tool results must be stored in context as long as the starting message is in the "recent" list.
  - No need to embed tool results.

- **Loggingg**

  - Implement custom local logging tool.
  - Logger tool should build properties over last call:
    - `console.log('message 1', { property1: 'value1' })` result in
      ```
      message 1
        property1: value1
      ```
      `console.log('message 2', { property2: 'value2' })` result in
      ```
      message 2
        property1: value1
        property2: value2
      ```
      `console.log('message 3', { property3: 'value3' })` result in
      ```
      message 3
        property1: value1
        property2: value2
        property3: value3
      ```

- **User Management**: Complete user management system

  - Subscription plan management
  - Usage tracking and limits
  - Onboarding
  - Generate unique code or token link, bound to the phone number, for payment and configuration
  - https://getlago.com/docs/welcome

- **Privacy & Compliance**: Data management features

  - Write Privacy policy
  - Write Terms of Service
  - Privacy controls and onboarding through WhatsApp custom messages
  - Privacy policy notice and TOS acceptance in first interaction
  - Data export functionality
  - Data deletion for GDPR compliance
  - Data redacting in logs and error messages

- **Performance & Reliability**: System improvements

- Cost Monitoring: Set up alerts for AI provider usage thresholds (e.g., via OpenAI dashboard hooks)
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
- Video processing
- Tools:
  - gerar PDF
  - Gerar planilha
  - Integração com Drives (Google, Microsoft, Dropbox)
  - Envio de Email
  - Gerar imagem
  - Editar imagem
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
- **Cloudflare**
  - Generous 10,000 Neurons/day:
    - bge-m3: 1075 N/M input tokens.
    - gpt-oss-120b: 31818 N/M input tokens, 68182 N/M output tokens.
    - gpt-oss-20b: 18182 N/M input tokens, 27273 N/M output tokens.
  - @cf/openai/gpt-oss-20b does not support streaming
- **OpenAI**
  - OpenAI only opens URLs if `web_search_preview` is enabled; `gpt-4.1-nano` does not support `web_search_preview`.
  - GPT-4.1 has 1M tokens context window, but degrades quite fast: https://openai.com/index/gpt-4-1/
- **Gemini**
  - Gemini flash models can only format output text if turning on thinking mode.
  - Gemini grounding search is too expensive.
- **Grok**
  - Grok 4 is bad at respecting system instructions and tool usage: does not respect chunking guidelines, splits in chunks of 1000+ characters.
- **Document Parsing**
  - Gemini flash models are a lot faster than GPT at reading pdf files:
    - GPT-4o: got lost reading a pdf with flattened pages, reached a line where it started repeating the same text over and over again.
    - GPT 4o: 2m
    - GPT 4o mini: 2m
    - GPT 4.1 nano: 1m
    - Gemini 2.5 flash: 20s
    - Gemini 2.5 flash-lite: 10s
    - _Grok 4 fast: To be tested_
    - _GPT 5 mini: To be tested_
    - _GPT 5 nano: To be tested_
