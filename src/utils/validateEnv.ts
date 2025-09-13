export function validateEnvVars() {
  const requiredEnvVars = [
    'WEBHOOK_VERIFY_TOKEN',
    'META_API_TOKEN',
    'META_APP_SECRET',
    'WA_API_VERSION',
    'OPENAI_API_KEY',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'CF_ACCOUNT_ID',
    'CF_API_TOKEN',
    'MAX_RECENT_MESSAGES',
    'VECTOR_DISTANCE_THRESHOLD',
    'MAX_SIMILAR_MESSAGES',
    'TEXT_GENERATION_PROVIDER',
    'AUDIO_TRANSCRIPTION_PROVIDER',
    'IMAGE_ANALYSIS_PROVIDER',
  ]

  const missingVars = requiredEnvVars.filter((varName) => !import.meta.env[varName])

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
  }
}
