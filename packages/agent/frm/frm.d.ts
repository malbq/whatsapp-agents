declare global {
  interface ImportMetaEnv {
    CF_ACCOUNT_ID: string
    CF_API_TOKEN: string
    META_API_TOKEN: string
    META_WEBHOOK_VERIFY_TOKEN: string
    META_APP_SECRET: string
    WA_BUSINESS_PHONE_ID: string
  }
}

export {}
