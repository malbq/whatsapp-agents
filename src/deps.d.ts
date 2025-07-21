import type { AI } from './infra/ai'
import type { Chat } from './infra/chat'
import type { DB } from './infra/db'
import type { Storage } from './infra/storage'

declare global {
  interface Deps {
    chat: Chat
    storage: Storage
    ai: AI
    db: DB
  }
}

export {}
