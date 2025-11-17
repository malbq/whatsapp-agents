# Progress

## Refactor

- zapid embedding + similarity search
- zapid tool: when google places tool send message, replace assistant/tool pair with location/contact message
- zapid tool: update user profile in background

## Next

- Turn sendFile tool into structured output
- Simplify dependency injection by providing/injecting only individual operations, instead of entire interfaces (DB, Storage, AI, etc).
- resend typing indicator after whatsapp time out while assistant is generating response
- Improve tool instructions and anti-patterns (like re-search if recent search results are available)
- Test Parallel Search API: https://parallel.ai/blog/introducing-parallel-search
- Halt generation when user sends another message before assistant responds - do not halt audio or file ingestion
- Retry when model fails to respect output schema
- flag assistant messages with sent/delivered/read/failed status

## Hybrid context retrieval using PostgreSQL (FTS/tsvector + embeddings + RRF).

- Generate embeddings only for non-tool messages.
- Add a plain TSVECTOR column message.fts (NOT GENERATED). Populate it at INSERT/UPDATE using SQL: fts = to_tsvector('simple', unaccent($normalizedText)), where $normalizedText is extracted in TypeScript from model_message. Do not store a separate message.text or any model_message.normalized_text. Create GIN index: CREATE INDEX idx_message_fts ON message USING gin (fts). Enable unaccent extension.
- Vector search runs over embedding chunks filtered by user_id, ordered by vector distance, with a LIMIT K. Aggregate chunk similarities to message-level using max(similarity) by default (allow top-k mean as an option). Keep the best chunk per message for snippet.
- Apply a configurable similarity/distance threshold to vector hits before fusion; discard messages whose aggregated semantic score falls below the threshold.
- Hybrid ranking must combine vector and text results at message level using Reciprocal Rank Fusion with k = 10: score = 1/(vectorRank + k) + 1/(textRank + k). Missing ranks count as ∞ (i.e., contribute only from the present list).
- The fused candidate set must be the top N messages by RRF score (N = limit), after thresholding the vector list.
- Include text-only matches (messages present only in the FTS list) up to the remaining budget without duplicating messages already selected via vector hits.
- Deduplicate the final set strictly by message id.
- Make these parameters configurable per query: limit (default 10), vector similarity/distance threshold (default 0.0 equivalent), RRF k (default 10), chunk aggregation mode (default max).
- Out of scope for now: FTS over chunks; only message-level FTS via message.fts.

## Demo Agent

- Transform cmd agent in demo agent:

  - no history
  - echo transcription of audio messages
  - describe images
  - summarize documents
  - /web command
  - /react command

- **Human Takeover**

- Steps: detect_issue → notify_human_queue → claim → resolve → handback.
- Policies during human_active: AI restricted to assist/suggest-only; limited tool set (e.g., read-only web_fetch; block side effects).
- Notifications and SLAs: Events on entering pending_human; timers/escalation for response SLAs.
- Audit trail: Record transitions with actor (system/AI/human) and reason to support compliance.

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

  - Token budget management:
    - Batch requests close in time
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

Pair type=file+role=user represent a file uploaded by user
Pair type=file+role=tool represent a file sent by assistant with send_file tool

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
