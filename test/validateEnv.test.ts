import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { validateEnvVars } from '../src/utils/validateEnv'

const originalEnv = Object.assign({}, import.meta.env)

beforeEach(() => {
  Object.assign(import.meta.env, originalEnv)
})

afterEach(() => {
  Object.assign(import.meta.env, originalEnv)
})

describe('validateEnv', () => {
  test('validates all environment variables successfully', () => {
    expect(() => validateEnvVars()).not.toThrow()
  })

  test('throws error when WEBHOOK_VERIFY_TOKEN is missing', () => {
    delete import.meta.env.WEBHOOK_VERIFY_TOKEN
    expect(() => validateEnvVars()).toThrow(
      'Missing required environment variables: WEBHOOK_VERIFY_TOKEN'
    )
  })

  test('throws error when multiple variables are missing', () => {
    delete import.meta.env.OPENAI_API_KEY
    delete import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY
    delete import.meta.env.CF_ACCOUNT_ID
    expect(() => validateEnvVars()).toThrow(
      'Missing required environment variables: OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, CF_ACCOUNT_ID'
    )
  })

  test('throws error when all variables are missing', () => {
    Object.keys(import.meta.env).forEach((key) => {
      delete import.meta.env[key]
    })
    expect(() => validateEnvVars()).toThrow(
      'Missing required environment variables: WEBHOOK_VERIFY_TOKEN, META_API_TOKEN, META_APP_SECRET, WA_API_VERSION, OPENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, CF_ACCOUNT_ID, CF_API_TOKEN, MAX_RECENT_MESSAGES, SIMILARITY_THRESHOLD, MAX_SIMILAR_MESSAGES, TEXT_GENERATION_PROVIDER, AUDIO_TRANSCRIPTION_PROVIDER, IMAGE_ANALYSIS_PROVIDER'
    )
  })
})
