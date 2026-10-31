import { PGlite } from '@electric-sql/pglite'
import { vector } from '@electric-sql/pglite-pgvector'
import { createRecordingChat, mockWhatsappModel } from '@wa/core/testing'
import type { MessageNotification } from '@wa/whatsapp'
import { describe, expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import type { CalendarAdapter } from '../calendar/types'
import { createWardenRepository } from '../db'
import * as schema from '../dbSchema'
import { processMessage, type ProcessMessageDeps } from './processMessage'

const CUSTOMER_WA_ID = '5511999990000'

async function createTestRepository() {
  const pg = await PGlite.create({ extensions: { vector } })
  await pg.exec('CREATE EXTENSION IF NOT EXISTS vector')
  const client = drizzle(pg, { schema })
  await migrate(client, { migrationsFolder: `${import.meta.dir}/../drizzle` })
  return createWardenRepository(client)
}

/** Calendar with no availability and no appointments; never touches Google */
const offlineCalendar: CalendarAdapter = {
  checkAvailability: async (options) => ({ slots: [], timezone: options.timezone }),
  verifySlotAvailable: async () => false,
  bookAppointment: async () => {
    throw new Error('bookAppointment is not available offline')
  },
  cancelAppointment: async () => {},
  getAppointment: async () => null,
  updateAppointment: async () => {
    throw new Error('updateAppointment is not available offline')
  },
  getCalendarTimezone: async () => 'America/Sao_Paulo',
}

async function createTestDeps(model: ProcessMessageDeps['model']) {
  return {
    db: await createTestRepository(),
    chat: createRecordingChat(),
    calendar: offlineCalendar,
    model,
  } satisfies ProcessMessageDeps
}

function notification(message: MessageNotification['message']): MessageNotification {
  return {
    userWaId: CUSTOMER_WA_ID,
    userName: 'Test Customer',
    userPhone: CUSTOMER_WA_ID,
    timestamp: new Date(),
    message,
  }
}

describe('warden processMessage (offline)', () => {
  test('replies to a text message and persists the exchange', async () => {
    const model = mockWhatsappModel({ type: 'text', text: 'Hi! How can I help you today?' })
    const deps = await createTestDeps(model)

    await processMessage(deps)(
      notification({ type: 'text', messageWaId: 'wamid.in.1', text: 'Hello' })
    )

    expect(model.doGenerateCalls).toHaveLength(1)
    expect(deps.chat.sent).toEqual([
      {
        method: 'sendText',
        userId: CUSTOMER_WA_ID,
        message: { text: 'Hi! How can I help you today?' },
      },
    ])

    const [thread] = await deps.db.listThreads()
    expect(thread?.externalId).toBe(CUSTOMER_WA_ID)
    expect(thread?.messages.map((m) => m.role).toSorted()).toEqual(['assistant', 'user'])
  })

  test('rejects non-text messages without calling the model', async () => {
    const model = mockWhatsappModel()
    const deps = await createTestDeps(model)

    await processMessage(deps)(
      notification({
        type: 'location',
        messageWaId: 'wamid.in.2',
        latitude: -23.5,
        longitude: -46.6,
      })
    )

    expect(model.doGenerateCalls).toHaveLength(0)
    expect(deps.chat.sent).toMatchObject([
      {
        method: 'sendText',
        userId: CUSTOMER_WA_ID,
        message: {
          text: "Sorry, I don't understand this type of message. Please send a text message.",
        },
      },
    ])
  })
})
