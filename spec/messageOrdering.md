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
├── id (UUIDv7, PK)
├── userId
├── role (user | assistant | tool)
├── modelMessage (JSON - single message)
├── timestamp (default NOW())
├── usageInputTokens, usageOutputTokens, ... (per-message usage)
└── ...
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
├── id (UUIDv7, PK)
├── userId
├── role (user | assistant)
├── messages (JSON array of { modelMessage, usage? })
├── timestamp
└── ...
```

For user messages, `messages` contains a single element. For assistant turns, it contains the full sequence: tool-calls, tool-results, and final response—preserving order.

### Usage Tracking

Embed usage per-message within the JSON array:

```typescript
type TurnMessages = Array<{
  modelMessage: AssistantModelMessage | ToolModelMessage
  usage?: LanguageModelUsage // present for assistant messages, null for tool results
}>
```

This preserves per-tool-call usage granularity while keeping everything in one row.

## Trade-offs

### Pros

| Benefit                   | Description                                                     |
| ------------------------- | --------------------------------------------------------------- |
| **Ordering guaranteed**   | Array order is deterministic; no timestamp/UUID race conditions |
| **Atomic storage**        | One insert per turn; no partial states on failure               |
| **Simpler retrieval**     | Fetch N turns instead of N fragmented messages                  |
| **Matches LLM semantics** | A "turn" is the natural unit for assistant responses            |

### Cons

| Drawback                                  | Description                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| **Harder to query individual tool calls** | Need JSON path queries to filter by tool name                                           |
| **Larger JSON payloads**                  | Minimal impact, but worth noting                                                        |
| **Migration required**                    | Existing rows need reshaping                                                            |
| **Snippet relationship**                  | Snippets currently reference `messageId`; need to decide how to handle bundled messages |

## Alternatives Considered

### 1. Add `sequence` column

- Add an integer `sequence` column, auto-increment per turn or globally
- Order by `(timestamp, sequence)`
- **Pro**: Minimal schema change, keeps one-row-per-message
- **Con**: Adds complexity, still multiple rows per turn

### 2. Add `turnId` + `sequence`

- Group messages by `turnId`, order within group by `sequence`
- **Pro**: Flexible, queryable
- **Con**: More columns, more complex queries

### 3. Use UUIDv7 for ordering

- Change `ORDER BY timestamp` to `ORDER BY id`
- **Con**: Still has millisecond collision issues; doesn't solve the fundamental problem

## Recommendation

Adopt the **single row per turn** approach. The ordering guarantee is critical for correct agent behavior, and the cons are manageable:

- Usage tracking: embed in JSON array (preserves granularity)
- Tool call queries: rare enough that JSON path queries are acceptable
- Migration: one-time cost, can be scripted

## Implementation Notes

1. Update `toDbMessage` to return a single `DB.MessageInsert` for assistant turns with bundled messages
2. Update `findRecentMessages` to flatten the arrays when building context
3. Update snippet creation to handle bundled messages (possibly create snippets for the final text response only)
4. Migration script to bundle existing sequential assistant/tool rows by proximity in time
