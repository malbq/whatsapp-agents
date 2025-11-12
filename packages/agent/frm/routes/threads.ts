import type { DB } from '@batman/core/infra/db'
import type { Context } from 'hono'
import { ThreadsPage } from '../ui/pages'

export function createThreadsRoute(db: DB.Repository) {
  return async function threadsRoute(c: Context) {
    const users = await db.client.query.user.findMany({
      columns: {
        id: true,
        name: true,
        waId: true,
      },
      orderBy: (user, { desc }) => [desc(user.joinedAt)],
    })

    const threads: Array<{
      userId: string
      userName: string
      externalId: string
      messages: Array<{
        id: string
        role: string
        type: string
        timestamp: string
        content: string
      }>
    }> = []

    for (const user of users) {
      const userId = user.id
      if (!userId) continue

      const messages = await db.client.query.message.findMany({
        where: (message, { eq }) => eq(message.userId, userId),
        orderBy: (message, { asc }) => [asc(message.timestamp)],
      })

      const messagesWithContent: Array<{
        id: string
        role: string
        type: string
        timestamp: string
        content: string
      }> = []

      for (const msg of messages) {
        const msgId = msg.id
        if (!msgId) continue

        const snippets = await db.client.query.snippet.findMany({
          columns: {
            content: true,
          },
          where: (snippet, { eq }) => eq(snippet.messageId, msgId),
          orderBy: (snippet, { asc }) => [asc(snippet.sequence)],
        })

        const content = snippets.map((e) => e.content).join('\n') || msg.type

        let role = 'unknown'
        if (msg.modelMessage) {
          try {
            const modelMessage =
              typeof msg.modelMessage === 'string' ? JSON.parse(msg.modelMessage) : msg.modelMessage
            role = modelMessage.role || 'unknown'
          } catch {
            role = 'unknown'
          }
        }

        messagesWithContent.push({
          id: msgId,
          role,
          type: msg.type,
          timestamp: msg.timestamp.toISOString(),
          content,
        })
      }

      threads.push({
        userId,
        userName: user.name,
        externalId: user.waId,
        messages: messagesWithContent,
      })
    }

    return c.html(ThreadsPage({ threads }))
  }
}
