declare global {
  interface ImportMetaEnv {
    DATABASE_URL: string
    OPENAI_API_KEY: string
    META_API_TOKEN: string
    META_WEBHOOK_VERIFY_TOKEN: string
    META_APP_SECRET: string
    WA_BUSINESS_PHONE_ID: string
    GOOGLE_CLIENT_ID: string
    GOOGLE_CLIENT_SECRET: string
    DASHBOARD_SESSION_SECRET: string
    DASHBOARD_REDIRECT_URI: string
    CALENDAR_REDIRECT_URI: string
    PORT?: string
  }
}

export {}
