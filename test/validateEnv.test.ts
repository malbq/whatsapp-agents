import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { validateEnvVars } from '../src/utils/validateEnv'

const env = import.meta.env as unknown as Record<string, any>
const originalEnv = Object.assign({}, env)

beforeEach(() => {
  Object.assign(env, originalEnv)
})

afterEach(() => {
  Object.assign(env, originalEnv)
})

describe('validateEnv', () => {
  test('validates all environment variables successfully', () => {
    expect(() => validateEnvVars()).not.toThrow()
  })

  test('throws error when META_WEBHOOK_VERIFY_TOKEN is missing', () => {
    delete env.META_WEBHOOK_VERIFY_TOKEN
    expect(() => validateEnvVars()).toThrow(
      'Missing required environment variables: META_WEBHOOK_VERIFY_TOKEN'
    )
  })

  test('throws error when multiple variables are missing', () => {
    delete env.OPENAI_API_KEY
    delete env.GOOGLE_GENERATIVE_AI_API_KEY
    delete env.CF_ACCOUNT_ID
    expect(() => validateEnvVars()).toThrow(
      'Missing required environment variables: OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, CF_ACCOUNT_ID'
    )
  })

  test('throws error when all variables are missing', () => {
    Object.keys(import.meta.env).forEach((key) => {
      delete import.meta.env[key]
    })
    expect(() => validateEnvVars()).toThrow(
      'Missing required environment variables: META_WEBHOOK_VERIFY_TOKEN, META_API_TOKEN, META_APP_SECRET, WA_API_VERSION, WA_BUSINESS_PHONE_ID, OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, CF_ACCOUNT_ID, CF_API_TOKEN, MAX_RECENT_MESSAGES, VECTOR_DISTANCE_THRESHOLD, MAX_SIMILAR_MESSAGES, TEXT_GENERATION_PROVIDER, AUDIO_TRANSCRIPTION_PROVIDER, IMAGE_ANALYSIS_PROVIDER'
    )
  })
})
