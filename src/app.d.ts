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
    WEBHOOK_VERIFY_TOKEN: string
    META_API_TOKEN: string
    META_APP_SECRET: string
    WA_API_VERSION: string
    OPENAI_API_KEY: string
    GOOGLE_GENERATIVE_AI_API_KEY: string
    CF_ACCOUNT_ID: string
    CF_API_TOKEN: string
    MAX_RECENT_MESSAGES: string
    SIMILARITY_THRESHOLD: string
    MAX_SIMILAR_MESSAGES: string
    TEXT_GENERATION_PROVIDER: string
    AUDIO_TRANSCRIPTION_PROVIDER: string
    IMAGE_ANALYSIS_PROVIDER: string
    TEST_AI?: string
  }
}

export {}
