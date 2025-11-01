declare global {
  interface ImportMetaEnv {
    PORT: string
    META_WEBHOOK_VERIFY_TOKEN: string
    META_APP_SECRET: string
    NODE_ENV?: string
  }
}

export {}
