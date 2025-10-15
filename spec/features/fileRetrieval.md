# File Retrieval Workflow

## Workflow

1. User sends a message.
2. LLM receives the message + recent chat context.
3. LLM decides it needs a file → issues search_files({ query = user-message }).

   - Backend runs a vector search over document chunks.
     - Future: add optional filters (mime, date_range, tag) to search_files.
   - Backend groups hits by file and returns the best K files.
- For each file include:
      - messageId (stable id to retrieve the file later)
      - filename
      - timestamp (uploaded at)
      - top snippet(s) with highlighted hit
      - aggregated similarity score (0–1)

4. LLM reviews the list.

- If one file is clearly relevant → call send_file({ messageId }).
- If several are close → ask clarifying question or present the list to the user for selection.
  - If confidence is low:
    - Discard scores lower than 0.50
    - If top.score within 0.50-0.85 → ask for more detail instead of retrieving.
    - If top.score ≥ 0.85 or top.score − second.score ≥ 0.10 → retrieve_file(top).
    - If top 2–3 within 0.00–0.10 → ask user to choose (present sorted list with filename).

5. Backend sends the object to the user in a document or image message.

### Notes

- Log all tool calls for auditability.
- Send ONE entry per file, not per chunk.
- The aggregated score is what you sort by; the LLM sees at most K files (e.g. 3–5).
- Highlighting is contextual; plain text only (no markdown), include ellipses … at boundaries.
- Cap snippets_per_file (default 1, max 3).
- File score is the average of chunk scores.
- Snippets must redact emails and numbers that look like credit cards via simple regex.
- Never expose storage keys. Only pass messageId to send_file.

## Example workflow

Example query: “Q1 budget”.

Vector store returns the 10 best chunks with score ≥ 0.50:

1. /files/finance/budget-2024.xlsx ‒ chunk 7 ‒ score 0 .93
2. /files/finance/budget-2024.xlsx ‒ chunk 8 ‒ 0 .91
3. /files/finance/budget-2024.xlsx ‒ chunk 3 ‒ 0 .87
4. /files/finance/budget-2023.xlsx ‒ chunk 5 ‒ 0 .80
5. /files/meetings/2024-01-12.md ‒ chunk 2 ‒ 0 .78
6. ~~/files/notes/random.txt ‒ chunk 1 ‒ 0.40~~ (discarded)
7. ...

Step A – group by storage_key (internal-only; do not expose)

budget-2024.xlsx → chunks {7, 8, 3}  
budget-2023.xlsx → {5}  
2024-01-12.md → {2}

Step B – compute an aggregated file score (average)

budget-2024.xlsx → average = 0 .90  
budget-2023.xlsx → 0 .80  
2024-01-12.md → 0 .78

Step C – build the list with top files:

```json
[
  {
    "messageId": "msg_01H...",
    "filename": "budget-2024.xlsx",
    "timestamp": "2024-04-02T10:12:00.000Z",
    "score": 0.9,
    "snippet": "…Marketing spend for Q1 totals 42 000 USD…"
  },
  {
    "messageId": "msg_01H...",
    "filename": "budget-2023.xlsx",
    "timestamp": "2023-04-05T09:00:00.000Z",
    "score": 0.8,
    "snippet": "…Q1 travel budget was reduced by 10 %…"
  },
  {
    "messageId": "msg_01H...",
    "filename": "2024-01-12.md",
    "timestamp": "2024-01-12T14:21:00.000Z",
    "score": 0.78,
    "snippet": "…Action item: update Q1 budget before board review…"
  }
]
```

Step D – LLM reviews the list and choose one
