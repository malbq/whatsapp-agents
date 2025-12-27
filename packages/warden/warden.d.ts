declare global {
  interface ImportMetaEnv {
    DATABASE_URL: string
    CF_ACCOUNT_ID: string
    CF_API_TOKEN: string
    OPENAI_API_KEY: string
    META_API_TOKEN: string
    META_WEBHOOK_VERIFY_TOKEN: string
    META_APP_SECRET: string
    WA_BUSINESS_PHONE_ID: string
    GOOGLE_CLIENT_ID: string
    GOOGLE_CLIENT_SECRET: string
    DASHBOARD_SESSION_SECRET: string
    DASHBOARD_REDIRECT_URI: string
    DASHBOARD_ALLOWED_DOMAINS: string
    CALENDAR_REDIRECT_URI: string
    PORT?: string
    APPOINTMENT_DURATION_MINUTES?: string
  }
}

export {}
