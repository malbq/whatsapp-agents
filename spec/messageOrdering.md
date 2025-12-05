# Message Ordering Problem

## Problem Statement

When the agent generates multi-step responses (tool calls + results + final answer), messages are stored as individual rows and later retrieved sorted by `timestamp`. This produces **incorrect ordering** because:

1. **Timestamp collisions**: Multiple messages inserted in rapid succession share the same timestamp (or have non-deterministic ordering within the same second/millisecond)
2. **UUIDv7 limitations**: The `id` column uses UUIDv7 which encodes millisecond-precision timestamps, but within the same millisecond the remaining bits are random—not sequential
3. **Result**: Tool results appear before their tool calls, assistant responses appear out of sequence

### Evidence

From a debug dump, two messages had IDs `019adb34-99ad-7000-...` and `019adb34-99ad-7001-...`—same millisecond timestamp prefix, random suffix. The conversation context sent to the model was jumbled: tool-results before tool-calls, responses before the queries that triggered them.

## Current Architecture

```
message table
├─ id (UUIDv7, PK)
├─ userId
├─ role (user | assistant | tool)
├─ modelMessage (JSON - single message)
├─ timestamp (default NOW())
├─ usageInputTokens, usageOutputTokens, ... (per-message usage - to be removed)
└─ ...
```

Messages are retrieved with:

```sql
SELECT ... FROM message WHERE userId = ? ORDER BY timestamp DESC LIMIT ?
```

Each assistant turn that involves tool use produces **multiple rows**:

- One row per tool-call (role=assistant)
- One row per tool-result (role=tool)
- One row for the final response (role=assistant)

## Proposed Solution: Single Row per Turn

Bundle all messages from a single assistant turn into one row. The `modelMessage` column would hold an **array** of model messages instead of a single message.

### Schema Change

```
message table (revised)
├─ id (UUIDv7, PK)
├─ userId
├─ role (user | assistant)
├─ messages (JSON array of modelMessage)
├─ timestamp
└─ ...
```

For user messages, `messages` contains a single element. For assistant turns, it contains the full sequence: tool-calls, tool-results, and final response—preserving order.

### Usage Tracking

Token usage is tracked in a separate `usage` table:

```
usage table
├─ id (UUIDv7, PK)
├─ messageId (FK → message.id)
├─ source (enum: 'image_analysis' | 'document_transcription' | 'audio_transcription' | 'tool_call' | 'assistant_response' | ...)
├─ modelMessageIndex (integer, nullable - only for assistant turn messages)
├─ inputTokens (integer)
├─ outputTokens (integer)
├─ totalTokens (integer)
├─ cachedInputTokens (integer, nullable)
├─ reasoningTokens (integer, nullable)
└─ timestamp (default NOW())
```

**Usage Sources:**

- `image_analysis`: Token usage from analyzing images (references user message)
- `document_transcription`: Token usage from transcribing documents (references user message)
- `audio_transcription`: Token usage from transcribing audio/voice (references user message)
- `tool_call`: Token usage for individual tool calls within an assistant turn (references assistant message, includes `modelMessageIndex`)
- `assistant_response`: Token usage for the final assistant response (references assistant message, includes `modelMessageIndex`)

**For User Messages:**

- Transcription/analysis usage references the user message `id` directly
- `modelMessageIndex` is `NULL` (not applicable)

**For Assistant Turns:**

- Each message in the bundled `messages` array can have corresponding usage rows
- `modelMessageIndex` indicates the position (0-indexed) within the `messages` array
- Tool results (role=tool) typically don't have usage rows, but tool calls and final responses do

This approach separates concerns: message ordering/structure vs. usage tracking, enabling flexible querying and aggregation of costs by source.

Adopt the **single row per turn** approach with a separate usage table. The ordering guarantee is critical for correct agent behavior, and the cons are manageable:

- Usage tracking: separate table enables flexible querying and aggregation by source
- Tool call queries: rare enough that JSON path queries are acceptable
- Migration: one-time cost, can be scripted
- Usage granularity: preserved through `modelMessageIndex` mapping for assistant turns

## Implementation Notes

1. **Schema Migration:**

   - Remove `usageInputTokens`, `usageOutputTokens`, `usageTotalTokens`, `usageCachedInputTokens`, `usageReasoningTokens` from `message` table
   - Create new `usage` table with columns: `id`, `messageId`, `source`, `modelMessageIndex`, `inputTokens`, `outputTokens`, `totalTokens`, `cachedInputTokens`, `reasoningTokens`
   - Add index on `usage.messageId` for efficient lookups

2. **Message Storage:**

   - Update `toDbMessage` to return a single `DB.MessageInsert` for assistant turns with bundled messages (no usage fields)
   - `messages` array contains only `modelMessage` objects (no embedded usage)

3. **Usage Storage:**

   - Create `toDbUsage` utility to convert `LanguageModelUsage` + metadata into `DB.UsageInsert`
   - For user messages: store transcription/analysis usage with `source` and `messageId` (no `modelMessageIndex`)
   - For assistant turns: store usage rows with `source` ('tool_call' or 'assistant_response'), `messageId`, and `modelMessageIndex` (0-indexed position in `messages` array)

4. **Retrieval:**

   - Update `respondeGeneration` to flatten the messages array received from `findRecentMessages`
