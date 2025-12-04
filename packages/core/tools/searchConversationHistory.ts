import { tool } from 'ai'
import { ok } from 'node:assert'
import { z } from 'zod'
import { generateEmbeddings } from '../ai/generateEmbeddings'
import type { ToolExecutionError } from '../errors'
import type { DB } from '../infra/db'

export interface SearchConversationHistoryContext {
  userId: string
  recentMessageIds: Array<string>
  searchSnippets: DB.Repository['searchSnippets']
}

export function createSearchConversationHistoryTool(ctx: SearchConversationHistoryContext) {
  return tool({
    title: 'search_conversation_history',
    description: `Search through past conversation history to find relevant context, details, or preferences mentioned in previous messages. Use this to answer questions about what was discussed previously or to recall specific details provided by the user. The query should be a semantic search string optimized to find the relevant information.
Examples:
- User query: "What is the secret door code I told you earlier?" => \`search_conversation_history\` query: "secret door code"
- User query: "What did we discuss about the auth flow?" => \`search_conversation_history\` query: "auth flow discussion"
- User query: "Do I have any preferences for code style?" => \`search_conversation_history\` query: "code style preferences"
- User query: "Remind me what I said about my mom's birthday gift ideas." => \`search_conversation_history\` query: "mom birthday gift ideas and preferences"
- User query: "What was the name of that Italian restaurant I liked?" => \`search_conversation_history\` query: "favorite Italian restaurant name and location"
- User query: "Did I mention when my flight to Tokyo is?" => \`search_conversation_history\` query: "Tokyo flight details schedule and date"`,
    inputSchema: z.object({
      query: z.string().describe('The query to search for relevant memories'),
    }),
    execute: async ({ query }) => {
      console.debug('search_conversation_history', { query })
      try {
        const [embeddings] = await generateEmbeddings([query])
        const queryEmbedding = embeddings?.[0]?.embedding
        ok(queryEmbedding, 'Query embedding not generated')

        const similarMessages = await ctx.searchSnippets({
          userId: ctx.userId,
          query,
          queryEmbedding,
          excludeIds: ctx.recentMessageIds,
        })

        console.debug('search_conversation_history results', { similarMessages })

        return similarMessages.map((message) => ({
          role: message.role,
          type: message.type,
          content: message.content,
          chunk: message.total > 1 ? `${message.sequence} of ${message.total}` : undefined,
          timestamp: message.timestamp.toISOString(),
        }))
      } catch (error) {
        console.error('search_conversation_history failed', { error })
        return {
          error: 'Tool execution failed',
          details: error instanceof Error ? error.message : 'unknown',
        } satisfies ToolExecutionError
      }
    },
  })
}
