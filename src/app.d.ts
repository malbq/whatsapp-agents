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

  interface ImportMetaEnv {
    PORT: string
    META_WEBHOOK_VERIFY_TOKEN: string
    META_API_TOKEN: string
    META_APP_SECRET: string
    WA_API_VERSION: string
    WA_BUSINESS_PHONE_ID: string
    CF_ACCOUNT_ID: string
    CF_GATEWAY_ID: string
    CF_API_TOKEN: string
    GOOGLE_AI_STUDIO_API_KEY: string
    MAX_RECENT_MESSAGES: string
    VECTOR_DISTANCE_THRESHOLD: string
    FILE_SEARCH_LIMIT: string
    MAX_SIMILAR_MESSAGES: string
    REMINDER_SENDING_STALE_SECONDS: string
    NODE_ENV?: string
    TEST_AI?: string
  }
}

// oxlint-disable-next-line
export {}
