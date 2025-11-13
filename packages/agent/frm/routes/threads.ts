import type { Context } from 'hono'
import type { FrmDB } from '../db'
import { ThreadsPage } from '../ui/pages'

export function createThreadsRoute(db: FrmDB) {
  return async function threadsRoute(c: Context) {
    const threads = await db.listThreads()
    return c.html(ThreadsPage({ threads }))
  }
}
