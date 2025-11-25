/*
File Retrieval Workflow

Workflow:
1) User sends a message.
2) LLM receives the message plus recent chat context.
3) LLM decides it needs a file and calls search_files.
   - Generate embeddings for the query and calls db.searchFiles.
   - Returns file results with messageId, filename, timestamp, snippet, and score.

4) LLM reviews the list.
   - If one file is clearly relevant, call send_file({ messageId }).
   - If several are close, ask a clarifying question or present the list for selection.
   Confidence guidance:
     - Discard scores lower than 0.50.
     - If top.score within 0.50–0.85, ask for more detail instead of retrieving.
     - If top.score ≥ 0.85 or (top.score − second.score) ≥ 0.10, retrieve_file(top).
     - If top 2–3 are within 0.00–0.10, ask the user to choose (present sorted list with filename).

5) Sends the object to the user as a document or image message.

Implementation details:
- Vector search uses cosine distance threshold (default 0.50)
- Groups chunks by messageId and calculates file score as average of chunk scores (1 - distance)
- Takes top 3 chunks per file for snippet generation, separated by double newlines
- Sanitizes snippets (redacts emails and credit card patterns)
- Sorts files by score descending and limits to MAX_FILES results (default 10)
- Never expose storage keys. Only pass messageId to send_file.

Example workflow:
Example query: "Q1 budget".

db.searchFiles returns the 10 best chunks with score ≥ 0.50:
1) /files/finance/budget-2024.xlsx — chunk 7 — score 0.93
2) /files/finance/budget-2024.xlsx — chunk 8 — 0.91
3) /files/finance/budget-2024.xlsx — chunk 3 — 0.87
4) /files/finance/budget-2023.xlsx — chunk 5 — 0.80
5) /files/meetings/2024-01-12.md — chunk 2 — 0.78
6) /files/notes/random.txt — chunk 1 — 0.40 (discarded)
7) ...

Step A — group by messageId (internal-only; do not expose)
- budget-2024.xlsx → chunks {7, 8, 3}
- budget-2023.xlsx → {5}
- 2024-01-12.md → {2}

Step B — compute an aggregated file score (average)
- budget-2024.xlsx → average = 0.90
- budget-2023.xlsx → 0.80
- 2024-01-12.md → 0.78

Step C — build the list with top files:
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

LLM reviews the list and chooses one to send via send_file.
*/
import type { ToolExecutionError } from '@batman/core/errors'
import { spreadError } from '@batman/core/utils/spreadError'
import { extractFilename } from '@batman/core/utils/storageKey'
import { tool } from 'ai'
import { z } from 'zod'

export interface SearchFilesDeps {
  userId: string
  generateEmbeddings: (texts: Array<string>) => Promise<Array<Array<{ embedding: Array<number> }>>>
  searchFiles: (params: { userId: string; queryEmbedding: Array<number> }) => Promise<
    Array<{
      messageId: string
      resourceId: string
      timestamp: Date
      score: number
      snippet: string
    }>
  >
  findResourceById: (params: {
    userId: string
    resourceId: string
  }) => Promise<{ storageKey: string; originalFilename?: string } | null>
  onExplanation?: (explanation: string) => Promise<void> | void
  onSearchResults?: (results: Array<{ messageId: string; filename: string | undefined }>) => void
}

export function createSearchFilesTool(deps: SearchFilesDeps, explanationPrompt: string) {
  return tool({
    name: 'search_files',
    description: `Search for files based on content similarity.
Use when the user asks about documents, files, or specific information that might be stored in uploaded files.
Generate an optimized search query to find the most relevant files.
Returns results with a score (0-1) indicating relevance.
After reviewing results: if one file is clearly relevant, call \`send_file\` with its messageId.
If several are close, ask a clarifying question or present the list for selection..
`,
    inputSchema: z.object({
      query: z.string().describe('The query to search for files'),
      explanation: z.string().describe(explanationPrompt),
    }),
    execute: async (params) => {
      try {
        const { query, explanation } = params

        await deps.onExplanation?.(explanation)

        const [embeddings] = await deps.generateEmbeddings([query])
        const files = await deps.searchFiles({
          userId: deps.userId,
          queryEmbedding: embeddings![0]!.embedding,
        })

        // Map results and fetch filenames from resources
        const output = await Promise.all(
          files.map(async (file) => {
            const resource = await deps.findResourceById({
              userId: deps.userId,
              resourceId: file.resourceId,
            })
            const filename = resource?.storageKey ? extractFilename(resource.storageKey) : undefined
            return {
              messageId: file.messageId,
              filename,
              timestamp: file.timestamp,
              snippet: file.snippet,
              score: file.score,
            }
          })
        )

        deps.onSearchResults?.(
          output.map((file) => ({
            messageId: file.messageId,
            filename: file.filename,
          }))
        )

        console.log('search_files completed', {
          ...params,
          filesCount: files.length,
          topScore: files[0]?.score ?? 0,
          files: await Promise.all(
            files.map(async (file) => {
              const resource = await deps.findResourceById({
                userId: deps.userId,
                resourceId: file.resourceId,
              })
              return {
                filename: resource?.storageKey ? extractFilename(resource.storageKey) : undefined,
                timestamp: file.timestamp,
                score: file.score,
              }
            })
          ),
        })
        console.debug('search_files results', { ...params, files: output })

        return output
      } catch (error) {
        console.error('search_files failed', {
          ...params,
          ...spreadError(error),
        })
        return {
          error: 'Tool execution failed',
          details: error instanceof Error ? error.message : 'unknown',
        } satisfies ToolExecutionError
      }
    },
  })
}
