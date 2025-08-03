export const PLANS = {
  free: {
    price: 0,
    duration_months: null,
    daily_tokens: 10000,
    daily_storage_bytes: 100 * 1024 * 1024,
    max_reminders: 10,
    models: {
      text: 'gpt-4o-mini',
      audio: 'whisper-1',
      image: 'gpt-4o-mini',
      document: 'gemini-1.5-flash',
      embedding: '@cf/baai/bge-small-en-v1.5',
    },
    limits: {
      text: 5000,
      audio: 2000,
      image: 1000,
      document: 2000,
      embedding: 1000,
    },
  },
  pro: {
    price: 19.99,
    duration_months: 1,
    daily_tokens: 100000,
    daily_storage_bytes: 2 * 1024 * 1024 * 1024,
    max_reminders: 100,
    models: {
      text: 'gpt-4o',
      audio: 'whisper-1',
      image: 'gpt-4o',
      document: 'gemini-1.5-pro',
      embedding: '@cf/baai/bge-large-en-v1.5',
    },
    limits: {
      text: 50000,
      audio: 20000,
      image: 10000,
      document: 20000,
      embedding: 10000,
    },
  },
} as const

export type PlanName = keyof typeof PLANS
export type UsageType = keyof typeof PLANS.free.limits
