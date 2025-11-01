export function validateEnvVars() {
  const requiredEnvVars = [
    'META_WEBHOOK_VERIFY_TOKEN',
    'META_API_TOKEN',
    'META_APP_SECRET',
    'WA_API_VERSION',
    'WA_BUSINESS_PHONE_ID',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'GOOGLE_PLACES_API_KEY',
    'CF_ACCOUNT_ID',
    'CF_API_TOKEN',
    'MAX_RECENT_MESSAGES',
    'VECTOR_DISTANCE_THRESHOLD',
    'FILE_SEARCH_LIMIT',
    'MAX_SIMILAR_MESSAGES',
    'REMINDER_SENDING_STALE_SECONDS',
  ]

  const missingVars = requiredEnvVars.filter((varName) => !import.meta.env[varName])

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
  }
}
