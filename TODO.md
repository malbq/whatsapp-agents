# Progress

## To Do

- Refactor message ordering [@messageOrdering.md](./spec/messageOrdering.md)
- Track transcription token usage
  - audio
  - image
  - document
- What should we do for long audios? One user send a 10min audio.

## Billing

- Subscription management
- Generate unique code or token link, bound to the phone number, for payment and configuration
- Stripe Billing

## Next

- o11y
  - AI SDK telemetry
- when new file is stored, run storage check in background to delete old files if quota exceeded
- every outbound message must be persisted to db, including error messages
- refactor whatsapp schemas/types
  - the difference between incoming and outgoing is not clear
  - outgoind document and image refer to resourceId, and record should be a unknown concept by whatsapp module

## UX Improvements

- flag assistant messages with sent/delivered/read/failed status

## Performance & Reliability

- Resend typing indicator after whatsapp time out while assistant is generating response (indicator lasts 25s)
- Support user sending contact/location messages
- Cost Monitoring: Set up alerts for AI provider usage thresholds (e.g., via OpenAI dashboard hooks)
- E2E tests for error scenarios, privacy flows, and rate limits
- Retry mechanisms
- Improved error handling
- Test Parallel Search API: https://parallel.ai/blog/introducing-parallel-search

## Privacy & Compliance

- Write Privacy policy
- Write Terms of Service
- Privacy controls and onboarding through WhatsApp custom messages
- Privacy policy notice and TOS acceptance in first interaction
- Data export functionality
- Data deletion for GDPR compliance
- Data redacting in logs and error messages
- Encryption at rest

## Human Takeover

- Steps: detect_issue → notify_human_queue → claim → resolve → handback.
- Policies during human_active: AI restricted to assist/suggest-only; limited tool set (e.g., read-only web_fetch; block side effects).
- Notifications and SLAs: Events on entering pending_human; timers/escalation for response SLAs.
- Audit trail: Record transitions with actor (system/AI/human) and reason to support compliance.

## Future (after MVP)

- Assistant couldn't analyze youtube video, should we try to do it via gemini?
- TTS: Answer with audio message
- Video processing
- Tools:
  - Create PDF
  - Create spreadsheet
  - Integrate with Drives (Google, Microsoft, Dropbox)
  - Send Email
  - Generate image
  - Edit image
- Automated DB backups
- Media storage snapshots
- Real-time TTS
  - Requires interactive message with type `call_permission_request`
  - [WhatsApp Cloud API Calling](https://developers.facebook.com/docs/whatsapp/cloud-api/calling)
- find better way to manage stored files
  - users can't see their files and decide what to keep if quota is exceeded
  - we could delete old files
  - we could track file refs, and delete least referenced files

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
