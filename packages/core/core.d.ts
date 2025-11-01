declare global {
  interface ImportMetaEnv {
    CF_ACCOUNT_ID: string
    CF_API_TOKEN: string
    MAX_RECENT_MESSAGES: string
    VECTOR_DISTANCE_THRESHOLD: string
    FILE_SEARCH_LIMIT: string
    MAX_SIMILAR_MESSAGES: string
    REMINDER_SENDING_STALE_SECONDS: string
    BRAVE_API_KEY: string
  }
}

export {}
