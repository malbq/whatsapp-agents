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
     TEMPLATE_NAME: string
     START_SECRET_TOKEN: string
   }
 }

export {}
