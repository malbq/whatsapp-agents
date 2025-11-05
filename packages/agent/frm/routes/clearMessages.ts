import type { DB } from '@batman/core/infra/db'
import type { Context } from 'hono'

export function createClearMessagesRoute(db: DB) {
  return async function clearMessagesRoute(c: Context) {
    const userId = c.req.param('userId')

    if (!userId) {
      return c.json({ success: false, error: 'User ID is required' }, 400)
    }

    try {
      // Delete all messages for the user (embeddings will cascade delete)
      await db.query('DELETE FROM message WHERE user_id = ?', [userId])

      return c.json({ success: true })
    } catch (error) {
      console.error('Error clearing messages:', error)
      return c.json(
        { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
        500
      )
    }
  }
}
