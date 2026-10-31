import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import { createAnalyzeImage } from '@wa/core/ai/analyzeImage'
import { createGenerateEmbeddings } from '@wa/core/ai/generateEmbeddings'
import { createTranscribeAudio } from '@wa/core/ai/transcribeAudio'
import { createTranscribeDocument } from '@wa/core/ai/transcribeDocument'
import type { WebSearch } from '@wa/core/infra/webSearch'
import {
  createMemoryStorage,
  createRecordingChat,
  mockEmbeddingModel,
  mockTextModel,
  mockWhatsappModel,
} from '@wa/core/testing'
import type { MessageNotification } from '@wa/whatsapp'
import type { LanguageModel } from 'ai'
import { describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import type { AgentDeps } from './context'
import { createZapidRepository } from './db'
import * as schema from './dbSchema'
import { createMessageHandler } from './handler'

const SEEDED_WA_ID = '1234567890'

async function createTestRepository() {
  const pg = await PGlite.create({ extensions: { vector } })
  await pg.exec('CREATE EXTENSION IF NOT EXISTS vector')
  const client = drizzle(pg, { schema })
  await migrate(client, { migrationsFolder: `${import.meta.dir}/drizzle` })
  await pg.exec(await Bun.file(`${import.meta.dir}/__fixtures__/base_user_seed.sql`).text())
  return createZapidRepository(client)
}

const offlineWebSearch: WebSearch = async () => []

async function createTestDeps(responseModel: LanguageModel) {
  const deps = {
    db: await createTestRepository(),
    chat: createRecordingChat(),
    storage: createMemoryStorage(),
    webSearch: offlineWebSearch,
    ai: {
      responseModel,
      transcribeAudio: createTranscribeAudio({ model: mockTextModel('transcript') }),
      analyzeImage: createAnalyzeImage({ model: mockTextModel('image description') }),
      transcribeDocument: createTranscribeDocument({ model: mockTextModel('document text') }),
      generateEmbeddings: createGenerateEmbeddings({ model: mockEmbeddingModel() }),
    },
    onboardingTemplate: 'onboarding_template',
    googlePlacesApiKey: 'unused',
  } satisfies AgentDeps
  return deps
}

function textNotification(text: string, userWaId = SEEDED_WA_ID): MessageNotification {
  return {
    userWaId,
    userName: 'Test User',
    userPhone: userWaId,
    timestamp: new Date(),
    message: { type: 'text', messageWaId: `wamid.in.${crypto.randomUUID()}`, text },
  }
}

describe('zapid message handler (offline)', () => {
  test('replies to a subscribed user and persists the exchange', async () => {
    const model = mockWhatsappModel({ type: 'text', text: 'Hi! How can I help?' })
    const deps = await createTestDeps(model)

    await createMessageHandler(deps)(textNotification('Hello'), '{}')

    expect(model.doGenerateCalls).toHaveLength(1)
    expect(deps.chat.sent).toEqual([
      {
        method: 'sendText',
        userId: SEEDED_WA_ID,
        message: { text: 'Hi! How can I help?' },
      },
    ])

    const messages = await deps.db.$client.query.message.findMany({
      where: eq(schema.message.userId, 'user_test_1'),
    })
    expect(messages.map((m) => m.role).toSorted()).toEqual(['assistant', 'user'])

    const ledger = await deps.db.$client.query.userEntitlementLedger.findMany()
    expect(ledger).toMatchObject([{ key: 'n_messages_per_day', value: 1 }])
  })

  test('sends the onboarding template to a new user instead of replying', async () => {
    const model = mockWhatsappModel()
    const deps = await createTestDeps(model)

    await createMessageHandler(deps)(textNotification('Hello', '5550000000'), '{}')

    expect(model.doGenerateCalls).toHaveLength(0)
    expect(deps.chat.sent).toMatchObject([
      { method: 'sendTemplate', userId: '5550000000', message: { name: 'onboarding_template' } },
    ])
  })
})
