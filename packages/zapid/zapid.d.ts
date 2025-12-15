declare global {
  interface ImportMetaEnv {
    DATABASE_URL: string
    META_API_TOKEN: string
    META_WEBHOOK_VERIFY_TOKEN: string
    META_APP_SECRET: string
    WA_BUSINESS_PHONE_ID: string
    OPENAI_API_KEY: string
    GOOGLE_PLACES_API_KEY: string
    WA_ONBOARDING_TEMPLATE: string
    PORT?: string
    SENTRY_DSN?: string
  }
}

export {}
