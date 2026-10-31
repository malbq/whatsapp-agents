import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnalyzeImage } from '@wa/core/ai/analyzeImage'
import {
  createCloudflareEmbeddingModel,
  createGenerateEmbeddings,
} from '@wa/core/ai/generateEmbeddings'
import { createTranscribeAudio } from '@wa/core/ai/transcribeAudio'
import { createTranscribeDocument } from '@wa/core/ai/transcribeDocument'
import { FilesystemStorage } from '@wa/core/infra/storageFilesystem'
import { WebSearchBrave } from '@wa/core/infra/webSearchBrave'
import { createWhatsappClient } from '@wa/whatsapp'
import { drizzle } from 'drizzle-orm/bun-sql'
import type { Config } from './config'
import type { AgentAI, AgentDeps } from './context'
import { createZapidRepository, type ZapidRepository } from './db'
import * as schema from './dbSchema'

export function createAgentAI(config: Config): AgentAI {
  const openai = createOpenAI({ apiKey: config.OPENAI_API_KEY })
  const google = createGoogleGenerativeAI({ apiKey: config.GOOGLE_GENERATIVE_AI_API_KEY })
  const embeddingModel = createCloudflareEmbeddingModel({
    accountId: config.CF_ACCOUNT_ID,
    apiToken: config.CF_API_TOKEN,
  })

  return {
    responseModel: openai.responses('gpt-5-mini-2025-08-07'),
    transcribeAudio: createTranscribeAudio({ model: google('gemini-2.5-flash') }),
    analyzeImage: createAnalyzeImage({ model: google('gemini-2.5-flash') }),
    transcribeDocument: createTranscribeDocument({ model: google('gemini-2.5-flash-lite') }),
    generateEmbeddings: createGenerateEmbeddings({ model: embeddingModel }),
  }
}

export function createDatabase(config: Config, url = config.DATABASE_URL): ZapidRepository {
  return createZapidRepository(drizzle(url, { schema }), {
    maxRecentMessages: config.MAX_RECENT_MESSAGES,
    maxSimilarMessages: config.MAX_SIMILAR_MESSAGES,
    fileSearchLimit: config.FILE_SEARCH_LIMIT,
    rrfK: config.RRF_K,
    reminderSendingStaleSeconds: config.REMINDER_SENDING_STALE_SECONDS,
  })
}

export function createAgentDeps(config: Config): AgentDeps {
  return {
    db: createDatabase(config),
    chat: createWhatsappClient({
      apiToken: config.META_API_TOKEN,
      businessPhoneId: config.WA_BUSINESS_PHONE_ID,
      apiVersion: config.WA_API_VERSION,
    }),
    storage: FilesystemStorage.storage('./storage'),
    webSearch: WebSearchBrave.createWebSearch({ apiKey: config.BRAVE_SEARCH_API_KEY }),
    ai: createAgentAI(config),
    onboardingTemplate: config.WA_ONBOARDING_TEMPLATE,
    googlePlacesApiKey: config.GOOGLE_PLACES_API_KEY,
  }
}
