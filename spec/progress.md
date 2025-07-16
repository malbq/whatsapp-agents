# Progress

## Current Focus

0. **POC**

   - Receive and parse documents
   - Parse document into chunks and embed
   - Document parsing approach:
     - Phase 1: pdf.js for native PDF text extraction (semantic text preservation)
     - Phase 2: Tesseract.js OCR fallback for scanned documents
     - Phase 3: GPT-4o-mini for complex/failed extractions
     - Pure text output optimized for embedding (no structured output needed)

1. **Basic communication**

   - Persist messages in chat table
     - Only audio transcription is persisted, no audio file
   - Embed messages
   - Treat audio with `voice: true` as user direct input, like text messages
   - Treat audio with `voice: false` as external content, like images and documents
   - **Tool** `web_search`
     - If searching for a business, try to find contact info and location and reply with appropriate WhatsApp message types

## Next

- **Media handling**
  - Persist image descriptions with reference in chat table
  - Persist document content with reference in chat table
  - Persist images and documents in object store
  - Embed image descriptions
  - Embed documents content
  - **Tool** `retrieve_file`
- **Context orchestration**
  - Recent conversation history from chat table
  - User profile management and automatic improvement
  - Memory: Vector search for similar content (see `memoryRetrieval.md`) (TODO)
    - document match, we have 3 options:
      - add the chunk to context
      - add whole file to the prompt via file_search and URL parameter
      - both
    - image match:
      - add image and its description to context
- **Scheduler**
  - Schedule management
  - Schedule triggering
  - Add schedule to context
  - **Tools** `create_reminder` and `cancel_reminder`
- Privacy features (delete/export) and onboarding
- Rate limiting, retry/back-off, improved error handling
- TTS: Answer with audio message

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
