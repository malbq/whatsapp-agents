import { z } from 'zod'

const required = z.string().min(1)
const optionalInt = z.coerce.number().int().positive().optional()

const envSchema = z.object({
  PORT: z.coerce.number().int().default(8080),
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: required,

  META_API_TOKEN: required,
  META_APP_SECRET: required,
  META_WEBHOOK_VERIFY_TOKEN: required,
  WA_BUSINESS_PHONE_ID: required,
  WA_API_VERSION: z.string().default('v23.0'),
  WA_ONBOARDING_TEMPLATE: required,

  OPENAI_API_KEY: required,
  GOOGLE_GENERATIVE_AI_API_KEY: required,
  CF_ACCOUNT_ID: required,
  CF_API_TOKEN: required,
  BRAVE_SEARCH_API_KEY: required,
  GOOGLE_PLACES_API_KEY: required,

  MAX_RECENT_MESSAGES: optionalInt,
  MAX_SIMILAR_MESSAGES: optionalInt,
  FILE_SEARCH_LIMIT: optionalInt,
  RRF_K: optionalInt,
  REMINDER_SENDING_STALE_SECONDS: optionalInt,
})

export type Config = z.infer<typeof envSchema>

export function loadConfig(env: Record<string, string | undefined> = import.meta.env): Config {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
