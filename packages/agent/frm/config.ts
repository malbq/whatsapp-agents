import { createOpenAI } from '@ai-sdk/openai'
import { LibSql } from '@batman/core/infra/dbLibSql'
import { createCloudflareCompatibleFetch } from '@batman/core/utils/cloudflareFetch'
import { createWhatsappClient } from '@batman/whatsapp'
import { initializeDataStore } from './dataStore'

export const config = {
  PORT: import.meta.env.PORT || '8080',
  META_WEBHOOK_VERIFY_TOKEN: import.meta.env.META_WEBHOOK_VERIFY_TOKEN,
  META_APP_SECRET: import.meta.env.META_APP_SECRET,
  MAX_STEPS: 10,
} as const

export const { dataStore, saveData } = await initializeDataStore()
export const db = LibSql.db({ url: 'file:./storage/frm.db' })
export const chat = createWhatsappClient({
  apiToken: import.meta.env.META_API_TOKEN,
  businessPhoneId: import.meta.env.WA_BUSINESS_PHONE_ID,
})

const cfProvider = createOpenAI({
  baseURL: `https://api.cloudflare.com/client/v4/accounts/${import.meta.env.CF_ACCOUNT_ID}/ai/v1`,
  apiKey: import.meta.env.CF_API_TOKEN,
  fetch: createCloudflareCompatibleFetch(fetch),
})

export const languageModel = cfProvider.languageModel('@cf/openai/gpt-oss-20b')
