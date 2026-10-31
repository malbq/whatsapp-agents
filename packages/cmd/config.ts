import { z } from 'zod'

const required = z.string().min(1)

const envSchema = z.object({
  PORT: z.coerce.number().int().default(8080),
  NODE_ENV: z.string().default('development'),
  META_API_TOKEN: required,
  META_APP_SECRET: required,
  META_WEBHOOK_VERIFY_TOKEN: required,
  WA_BUSINESS_PHONE_ID: required,
  WA_API_VERSION: z.string().default('v23.0'),
})

export type Config = z.infer<typeof envSchema>

export function loadConfig(env: Record<string, string | undefined> = import.meta.env): Config {
  const result = envSchema.safeParse(env)
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
