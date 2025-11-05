import type { DB } from '@batman/core/infra/db'
import type { Context } from 'hono'
import { ThreadsPage } from '../ui/pages'

export function createThreadsRoute(db: DB) {
  return async function threadsRoute(c: Context) {
    const users = await db.query(
      `SELECT DISTINCT u.* FROM user u
       INNER JOIN message m ON u.id = m.user_id
       ORDER BY u.joined_at DESC`
    )

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

    for (const user of users.rows) {
      const userId = user.id
      if (!userId) continue

      const messages = await db.query(
        'SELECT * FROM message WHERE user_id = ? ORDER BY timestamp ASC',
        [userId]
      )

      const messagesWithContent: Array<{
        id: string
        role: string
        type: string
        timestamp: string
        content: string
      }> = []

      for (const msg of messages.rows) {
        const msgId = msg.id
        if (!msgId) continue

        const embeddings = await db.query(
          'SELECT content FROM embedding WHERE message_id = ? ORDER BY sequence ASC',
          [msgId]
        )

        const content = embeddings.rows.map((e) => e.content as string).join('\n') || (msg.type as string)

        messagesWithContent.push({
          id: msgId as string,
          role: msg.role as string,
          type: msg.type as string,
          timestamp: msg.timestamp as string,
          content,
        })
      }

      threads.push({
        userId: userId as string,
        userName: user.name as string,
        externalId: user.external_id as string,
        messages: messagesWithContent,
      })
    }

    return c.html(ThreadsPage({ threads }))
  }
}
