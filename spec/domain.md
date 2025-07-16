# Domain Model

## Entities

- **User**

  - `id: string`
  - `waId: string`
  - `name: string`
  - `phoneNumber: string`
  - `createdAt: Date`
  - `plan: 'free' | 'pro'`
  - `status: 'active' | 'delinquent' | 'blocked'`
  - `profile: string`

- **Memory Chunk**

  - `id: string`
  - `userId: string`
  - `content: string`
  - `embedding: number[]`
  - `timestamp: Date`
  - `source: SourceMetadata`

- **SourceMetadata**

  - `type: 'user_message' | 'assistant_response' | 'document' | 'image_description' | 'audio_transcript'`
  - `document?: DocumentSource`
  - `image?: ImageSource`
  - `message?: MessageSource`

- **DocumentSource**

  - `filename: string`
  - `mimeType: string`
  - `objectStoreKey: string`
  - `pageNumber?: number`
  - `sectionTitle?: string`

- **ImageSource**

  - `filename?: string`
  - `objectStoreKey: string`
  - `analysisModel: string`
  - `confidence?: number`
  - `mimeType: string`
  - `sha256: string`
  - `fileSize: number`

- **MessageSource**

  - `role: 'user' | 'assistant'`
  - `whatsappMessageId: string`
  - `llmModel?: string`
  - `toolCalls?: string[]`

- **Reminder**

  - `id: string` (primary key)
  - `userId: string`
  - `content: string`
  - `dueAt: Date`
  - `sent: boolean`

- **SubscriptionPlan**

  - `id: 'free' | 'pro' | 'enterprise'`
  - `dailyTokens: number`
  - `storageQuotaMb: number`
  - `remindersLimit: number`

- **PaymentTransaction**

  - `id: string` (primary key)
  - `userId: string`
  - `amount: number`
  - `currency: string`
  - `status: 'pending' | 'success' | 'failed'`
  - `reference: string`
  - `createdAt: Date`

- **SupportTicket**

  - `id: string` (primary key)
  - `userId: string`
  - `protocol: string`
  - `summary: string`
  - `createdAt: Date`
  - `status: 'open' | 'in_progress' | 'closed'`

- **File**

  - `id: string` (primary key)
  - `userId: string`
  - original message
  - `type: 'image' | 'document'`
  - `mimeType: string`
  - `filename: string`
  - `storagePath: string`
  - `sha256: string`
  - `fileSize: number`
  - `createdAt: Date`

## Use Cases / Features

1. **Receive Message** – store inbound WhatsApp message as `Message` and link to `Conversation`.
2. **Mark as Read** – acknowledge message in WhatsApp thread.
3. **Generate Reply** – create assistant response via LLM and store as `Message`.
4. **Embed Message** – generate vector and save to `embedding` field.
5. **Retrieve Context**
   - User profile
   - Recent messages
   - Scheduled reminders
   - Vector search for similar messages and file chunks
6. **Create Schedule** – save `Schedule` with due time.
7. **Deliver Schedule** – send WhatsApp message when `dueAt` reached.
8. **Delete Schedule** – delete `Schedule` when it's user request.
9. **Cancel Schedule** – delete `Schedule` when it's no longer needed.
10. **Transcribe Audio** – convert voice note to text and treat as message content.
11. **Analyze Image** – download WhatsApp media, convert to base64, analyze with vision model, generate description.
12. **Ingest File** – save `File` metadata and link to message.
13. **Retrieve File** – provide file or summary back to user on demand.
14. **Download Media** – fetch WhatsApp media with metadata (mime type, sha256, file size).
15. **Enforce Quotas** – check usage against `SubscriptionPlan` limits per request.
16. **Process Payment** – create `PaymentTransaction` from WhatsApp Pay callback.
17. **Upgrade Plan** – change `User.plan` on successful payment.
18. **Downgrade Plan** – adjust plan on failed renewal or delinquency.
19. **Rate Limit** – throttle requests when daily tokens exhausted.
20. **Escalate Support** – detect escalation intent and create `SupportTicket`.
21. **Export Data** – package all user data for download on request.
22. **Delete Data** – remove user data for GDPR-style erasure.
23. **Verify Webhook** – validate Meta callbacks via token check.
24. **Health Check** – respond with greeting on root endpoint for uptime probes.
