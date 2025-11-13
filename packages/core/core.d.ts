declare global {
  interface ImportMetaEnv {
    MAX_RECENT_MESSAGES: string
    VECTOR_DISTANCE_THRESHOLD: string
    FILE_SEARCH_LIMIT: string
    MAX_SIMILAR_MESSAGES: string
    REMINDER_SENDING_STALE_SECONDS: string
    // must be provided by agent
    CF_ACCOUNT_ID: string
    CF_API_TOKEN: string
    GOOGLE_GENERATIVE_AI_API_KEY: string
    BRAVE_SEARCH_API_KEY: string
  }
}

export {}
