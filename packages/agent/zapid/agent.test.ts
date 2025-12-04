import type { Storage } from '@batman/core/infra/storage'
import { FilesystemStorage } from '@batman/core/infra/storageFilesystem'
import type { WebSearch } from '@batman/core/infra/webSearch'
import { WebSearchBrave } from '@batman/core/infra/webSearchBrave'
import type { Chat } from '@batman/whatsapp'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { and, eq } from 'drizzle-orm'
import { styleText } from 'node:util'
import { agent } from './agent'
import { runContext } from './context'
import { dbFactory, type UserEntitlements, type UserWithProfile, type ZapidRepository } from './db'
import { userQuota } from './dbSchema'
import { ingest } from './ingest'

async function queryUserQuota(
  db: ZapidRepository,
  userId: string,
  key: string
): Promise<{ used: number } | undefined> {
  const rows = await db.$client
    .select({ used: userQuota.used })
    .from(userQuota)
    .where(and(eq(userQuota.userId, userId), eq(userQuota.key, key)))
  return rows[0]
}

interface MockChat extends Chat {
  sentMessages: Array<
    | Parameters<Chat['sendText']>[1]
    | Parameters<Chat['sendImage']>[1]
    | Parameters<Chat['sendDocument']>[1]
    | Parameters<Chat['sendLocation']>[1]
    | Parameters<Chat['sendReaction']>[1]
    | Parameters<Chat['sendContact']>[1]
    | Parameters<Chat['sendInteractiveList']>[1]
    | Parameters<Chat['sendInteractiveButton']>[1]
    | Parameters<Chat['sendInteractiveCtaUrl']>[1]
    | Parameters<Chat['sendTemplate']>[1]
  >
}

async function createTestDatabase(): Promise<string> {
  const testDbName = `zapid_test_${Date.now()}`

  const createResult =
    await Bun.$`docker exec postgres-18 psql -U postgres -c "CREATE DATABASE ${testDbName}"`.text()

  if (!createResult.includes('CREATE DATABASE')) {
    throw new Error(`Failed to create test database: ${createResult}`)
  }

  console.log(styleText('dim', `⚙ Created database: ${testDbName}`))

  await Bun.$`docker exec postgres-18 psql -U postgres -d ${testDbName} -c "CREATE EXTENSION IF NOT EXISTS vector"`.quiet()

  const databaseUrl = `postgresql://postgres:postgres@localhost:5432/${testDbName}`
  import.meta.env.DATABASE_URL = databaseUrl

  await Bun.$`bun run drizzle-kit push --dialect=postgresql --schema=./dbSchema.ts --url=${databaseUrl}`
    .cwd(import.meta.dir)
    .quiet()

  console.log(styleText('dim', `⚙ Schema pushed to ${testDbName}`))

  return testDbName
}

async function dropTestDatabase(testDbName: string): Promise<void> {
  await Bun.$`docker exec postgres-18 psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${testDbName}'"`.quiet()

  const dropResult =
    await Bun.$`docker exec postgres-18 psql -U postgres -c "DROP DATABASE IF EXISTS ${testDbName}"`.text()

  if (!dropResult.includes('DROP DATABASE')) {
    console.warn(styleText('dim', `⚠ Failed to drop test database: ${dropResult}`))
  } else {
    console.log(styleText('dim', `⚙ Dropped database: ${testDbName}`))
  }
}

function createMockChat(): MockChat {
  const sentMessages: MockChat['sentMessages'] = []

  return {
    sentMessages,

    parseNotification: async () => null,
    acknowledgeMessage: async () => {},
    sendTypingIndicator: async () => {},

    async sendText(userWaId: string, message) {
      sentMessages.push(message)
      return `msg_${sentMessages.length}`
    },

    async sendImage(userWaId: string, message) {
      sentMessages.push(message)
      return `msg_${sentMessages.length}`
    },

    async sendDocument(userWaId: string, message) {
      sentMessages.push(message)
      return `msg_${sentMessages.length}`
    },

    async sendLocation(userWaId: string, message) {
      sentMessages.push(message)
      return `msg_${sentMessages.length}`
    },

    async sendReaction(userWaId: string, message) {
      sentMessages.push(message)
      return `msg_${sentMessages.length}`
    },

    async sendContact(userWaId: string, message) {
      sentMessages.push(message)
      return `msg_${sentMessages.length}`
    },

    async sendInteractiveList(userWaId: string, message) {
      sentMessages.push(message)
      return `msg_${sentMessages.length}`
    },

    async sendInteractiveButton(userWaId: string, message) {
      sentMessages.push(message)
      return `msg_${sentMessages.length}`
    },

    async sendInteractiveCtaUrl(userWaId: string, message) {
      sentMessages.push(message)
      return `msg_${sentMessages.length}`
    },

    async sendTemplate(userWaId: string, message) {
      sentMessages.push(message)
      return `msg_${sentMessages.length}`
    },
  }
}

let testDbName: string | undefined
let testStorageDir: string
let db: ZapidRepository
let storage: Storage
let chat: MockChat
let webSearch: WebSearch
let seededUser: UserWithProfile
let seededEntitlements: UserEntitlements
const imgBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAMgAAABkCAAAAADm7SDXAAAAAmJLR0QA/4ePzL8AAAQaSURBVHja7dfrb1N1HMfxd9vdwMyh4eKQGUhjAoG5LREv6GIckoVYb8TxQGV1RhdnDDEMLDGQo+ESWUhGskznQsLFaAhOCg4FEiioWdhAYIQELRtuDmFstJ+/wQfnbG3nfLYtYL6/R99zTj/99ZWe3+97DvqfDAxiEIMYxCAGMYhBDGIQgxjEIAYxiEEMYhCDGMQgBjGIQQxiEIMYxCAGMciEQzpisQGv/DkWG8y82BkO75b2hMMd4yQHYrErXnnn1x6vunU69vv4E/0dDn+aOqoJr59gSBDavTIfujIvRqFW+gAOjpPsCcD3brmSXDd5ZwEcGH+iXngidZRF8K6BaBm8KUn6IwD1kqQTcN/gPQfZCrOTktQA3u/6GF7WPQe5APwiSeUAHZJUBi13EeT09kjD+X9Dho9sjezsTMsugs2SrgVYChFJ1/xkXZekoeiWyM5zkqTjezp19bPI5RFIoi2ybl9iKiBXygH8awbHQI4GAVjZM5qth2WSGuHHAhZJ+grKJenwfABCvZJCLD5dAK0eJL4U4Fn/5EN6i/BV1j0DNZmQYzn4iivnwsIbI9lTkNUvPc/c5Go4J1XBdkk/ZOMvqSyEJTelEHmPAlEXMlwGs19ZlsVkQNJGl/QuNElai/+3dEhyIeyThqvcm0iSlCyEverNplb7YZMSM6FbSgThW2noVdgkhSAQOXFo0IU0Q1mfdNw36ZDh+90p4tCQDjkJT0nS5QBFo+F34C01QbtuTuMxnYRiSce8G+yCn6AUgnWpxV4BbZO22HfF3DEdutQFBaWlpaWlsDYd0gAfSZKKYHSVtEFh8gVm3ZFegosb3X9rG2yQJM2BfoXgbAoyCwamZtc6Bbkz3LErHfIJbJO3w54fCd/Oh2M5VEtqgS1Pwhm3meyQJBVDt0LeXuhCspk2RdvvRVg+Xh/5HNyno/kQH/3Aa7ACvpPUl0N5HvOSbqPcKEl6GP4cA8nHNzg1kORMZtwYB/ITVEhSPJuHUulW8FNwW5Iq8EGtJB2BSkm6GuARjYEs8XroFPSROqgekoaamjMgwwvwHZVUCx+m0n3ZwGrJ7SYQlaShIvwnpGQN1I+F1MHrCSXeY/IhPfMg+MaqOfhPZfSRg35ylleXQNH1tPhzwNeSpHgAZgxJkr7xkbtizRKY3zcWcj4XFq8KkjMFnf1CCQB5kWRmZ9/7IABll9LjO2D6Lbd8Gqq8s7sfAODxyxoLUXM2kNvw4oRDGh1n5PVom+P0SlLyUH34/aa4pG7HiUqHHeeiJP31ZV14fTSZEY87TqtXtjvOmZHT/V/UhTccTkrSfu9bbzlOiyR1bnh78yWddRrtVdcgBjGIQQxiEIMYxCAGMYhBDGIQgxjEIAYxiEEMYhCDGMQgBjGIQQxiEIP81/gHl+a1TDJF6GIAAAAASUVORK5CYII='

describe.skipIf(process.env.AI !== '1')('Agent', () => {
  beforeAll(async () => {
    testStorageDir = `/tmp/zapid-test-storage-${Date.now()}`
    await Bun.$`mkdir -p ${testStorageDir}`.quiet()
    console.log(styleText('dim', `⚙ Created test storage directory: ${testStorageDir}`))
  })

  afterAll(async () => {
    if (testStorageDir) {
      await Bun.$`rm -rf ${testStorageDir}`.quiet()
      console.log(styleText('dim', `⚙ Cleaned up test storage directory: ${testStorageDir}`))
    }
  })

  beforeEach(async () => {
    testDbName = await createTestDatabase()
    db = dbFactory()
    storage = FilesystemStorage.storage(testStorageDir)
    chat = createMockChat()
    webSearch = WebSearchBrave.createWebSearch()

    const seedSql = await Bun.file(`${import.meta.dir}/__fixtures__/base_user_seed.sql`).text()
    await db.$client.execute(seedSql)

    seededUser = (await db.findUserById({ id: 'user_test_1' }))!
    seededEntitlements = await db.getUserEntitlements({ userId: seededUser.id })
  })

  afterEach(async () => {
    if (testDbName) {
      await dropTestDatabase(testDbName)
    }
  })

  test(
    'responds to a greeting',
    async () => {
      await runContext(
        {
          db,
          storage,
          chat,
          webSearch,
          user: seededUser,
          entitlements: seededEntitlements,
          notification: {
            userName: seededUser.name,
            userWaId: seededUser.waId,
            userPhone: seededUser.waId,
            timestamp: new Date(),
            message: {
              type: 'text',
              messageWaId: 'wamid.1',
              text: 'Hello',
            },
          },
        },
        async () => {
          await ingest()
          await agent()
        }
      )

      expect(chat.sentMessages).toHaveLength(1)
      expect(chat.sentMessages[0]).toMatchObject({
        text: expect.stringMatching(/(hi|hello|hey|greetings)/i),
      })
    },
    { timeout: 60000 }
  )

  test(
    'tracks message usage in usage_ledger and v_user_quota',
    async () => {
      // Verify initial state - no usage recorded
      const initialLedger = await db.$client.query.usageLedger.findMany({
        where: (ledger, { eq }) => eq(ledger.userId, seededUser.id),
      })
      expect(initialLedger).toHaveLength(0)

      const initialQuota = await queryUserQuota(db, seededUser.id, 'n_messages_per_day')
      expect(initialQuota).toBeDefined()
      expect(initialQuota!.used).toBe(0)

      // Send first message
      await runContext(
        {
          db,
          storage,
          chat,
          webSearch,
          user: seededUser,
          entitlements: seededEntitlements,
          notification: {
            userName: seededUser.name,
            userWaId: seededUser.waId,
            userPhone: seededUser.waId,
            timestamp: new Date(),
            message: {
              type: 'text',
              messageWaId: 'wamid.usage.1',
              text: 'Hello',
            },
          },
        },
        async () => {
          await ingest()
          await agent()
        }
      )

      // Verify usage_ledger has an entry
      const ledgerAfterFirst = await db.$client.query.usageLedger.findMany({
        where: (ledger, { eq }) => eq(ledger.userId, seededUser.id),
      })
      expect(ledgerAfterFirst).toHaveLength(1)
      expect(ledgerAfterFirst[0]).toMatchObject({
        userId: seededUser.id,
        key: 'n_messages_per_day',
        value: 1,
      })

      // Verify v_user_quota shows used = 1
      const quotaAfterFirst = await queryUserQuota(db, seededUser.id, 'n_messages_per_day')
      expect(quotaAfterFirst).toBeDefined()
      expect(quotaAfterFirst!.used).toBe(1)

      // Send second message
      await runContext(
        {
          db,
          storage,
          chat,
          webSearch,
          user: seededUser,
          entitlements: seededEntitlements,
          notification: {
            userName: seededUser.name,
            userWaId: seededUser.waId,
            userPhone: seededUser.waId,
            timestamp: new Date(),
            message: {
              type: 'text',
              messageWaId: 'wamid.usage.2',
              text: 'How are you?',
            },
          },
        },
        async () => {
          await ingest()
          await agent()
        }
      )

      // Verify usage_ledger has two entries
      const ledgerAfterSecond = await db.$client.query.usageLedger.findMany({
        where: (ledger, { eq }) => eq(ledger.userId, seededUser.id),
      })
      expect(ledgerAfterSecond).toHaveLength(2)

      // Verify v_user_quota shows used = 2
      const quotaAfterSecond = await queryUserQuota(db, seededUser.id, 'n_messages_per_day')
      expect(quotaAfterSecond).toBeDefined()
      expect(quotaAfterSecond!.used).toBe(2)
    },
    { timeout: 120000 }
  )

  test(
    'describes an image',
    async () => {
      const imgBuffer = Uint8Array.fromBase64(imgBase64).buffer
      await runContext(
        {
          db,
          storage,
          chat,
          webSearch,
          user: seededUser,
          entitlements: seededEntitlements,
          notification: {
            userName: seededUser.name,
            userWaId: seededUser.waId,
            userPhone: seededUser.waId,
            timestamp: new Date(),
            message: {
              type: 'image',
              messageWaId: 'wamid.1',
              data: imgBuffer,
              mimeType: 'image/png',
            },
          },
        },
        async () => {
          await ingest()
          await agent()
        }
      )
      await runContext(
        {
          db,
          storage,
          chat,
          webSearch,
          user: seededUser,
          entitlements: seededEntitlements,
          notification: {
            userName: seededUser.name,
            userWaId: seededUser.waId,
            userPhone: seededUser.waId,
            timestamp: new Date(),
            message: {
              type: 'text',
              messageWaId: 'wamid.2',
              text: 'What is written on the image?',
            },
          },
        },
        async () => {
          await ingest()
          await agent()
        }
      )

      expect(chat.sentMessages).toHaveLength(2)
      expect(chat.sentMessages.at(-1)).toMatchObject({
        text: expect.stringMatching(/hello world/i),
      })
    },
    { timeout: 120000 }
  )

  test(
    'uses web_fetch tool to gather information',
    async () => {
      await runContext(
        {
          db,
          storage,
          chat,
          webSearch,
          user: seededUser,
          entitlements: seededEntitlements,
          notification: {
            userName: seededUser.name,
            userWaId: seededUser.waId,
            userPhone: seededUser.waId,
            timestamp: new Date(),
            message: {
              type: 'text',
              messageWaId: 'wamid.1',
              text: 'Open https://info.cern.ch/hypertext/WWW/People.html and list the people involved in the development of the World Wide Web.',
            },
          },
        },
        async () => {
          await ingest()
          await agent()
        }
      )

      const message = chat.sentMessages[0]!
      expect('text' in message).toBe(true)
      const responseText = 'text' in message ? message.text : ''
      expect(responseText).toMatch(/Eelco.*van.*Asperen/i)
      expect(responseText).toMatch(/Carl.*Barker/i)
      expect(responseText).toMatch(/Tim.*Berners.*Lee/i)
      expect(responseText).toMatch(/Robert.*Cailliau/i)
      expect(responseText).toMatch(/Dan.*Connolly/i)
      expect(responseText).toMatch(/Peter.*Dobberstein/i)
      expect(responseText).toMatch(/Alain.*Favre/i)
      expect(responseText).toMatch(/David.*Foster/i)
      expect(responseText).toMatch(/Jean.*Francois.*Groff/i)
      expect(responseText).toMatch(/Tony.*Johnson/i)
      expect(responseText).toMatch(/Paul.*Kunz/i)
      expect(responseText).toMatch(/Willem.*van.*Leeuwen/i)
      expect(responseText).toMatch(/Nicola.*Pellow/i)
      expect(responseText).toMatch(/Bernd.*Pollermann/i)
      expect(responseText).toMatch(/Pei.*Wei/i)
      expect(responseText).toMatch(/Bebo.*White/i)
      expect(responseText).toMatch(/James.*Whitescarver/i)
    },
    { timeout: 120000 }
  )

  test(
    'uses google_places tool to find location',
    async () => {
      await runContext(
        {
          db,
          storage,
          chat,
          webSearch,
          user: seededUser,
          entitlements: seededEntitlements,
          notification: {
            userName: seededUser.name,
            userWaId: seededUser.waId,
            userPhone: seededUser.waId,
            timestamp: new Date(),
            message: {
              type: 'text',
              messageWaId: 'wamid.1',
              text: 'Send me the location of the Eiffel Tower',
            },
          },
        },
        async () => {
          await ingest()
          await agent()
        }
      )

      expect(chat.sentMessages).toHaveLength(1)

      const locationMessage = chat.sentMessages[0]!
      expect('latitude' in locationMessage).toBe(true)
      expect('longitude' in locationMessage).toBe(true)
      expect('address' in locationMessage).toBe(true)
      const address =
        'address' in locationMessage && locationMessage.address ? locationMessage.address : ''
      expect(address).toMatch(/champ.*Mars.*75007.*paris/i)
    },
    { timeout: 120000 }
  )

  test(
    'uses google_places tool to find contact details',
    async () => {
      await runContext(
        {
          db,
          storage,
          chat,
          webSearch,
          user: seededUser,
          entitlements: seededEntitlements,
          notification: {
            userName: seededUser.name,
            userWaId: seededUser.waId,
            userPhone: seededUser.waId,
            timestamp: new Date(),
            message: {
              type: 'text',
              messageWaId: 'wamid.1',
              text: 'What is the phone number of the Bureau de Gustave Eiffel in Paris?',
            },
          },
        },
        async () => {
          await ingest()
          await agent()
        }
      )

      expect(chat.sentMessages).toHaveLength(1)

      const contactMessage = chat.sentMessages[0]!
      expect('phone' in contactMessage).toBe(true)
      expect('name' in contactMessage).toBe(true)
      const phone = 'phone' in contactMessage && contactMessage.phone ? contactMessage.phone : ''
      expect(phone.replace(/\s+/g, '').replace(/[^\d]/g, '')).toMatch(/33892701239/i)
    },
    { timeout: 120000 }
  )

  test(
    'uses web_search tool to find information',
    async () => {
      await runContext(
        {
          db,
          storage,
          chat,
          webSearch,
          user: seededUser,
          entitlements: seededEntitlements,
          notification: {
            userName: seededUser.name,
            userWaId: seededUser.waId,
            userPhone: seededUser.waId,
            timestamp: new Date(),
            message: {
              type: 'text',
              messageWaId: 'wamid.1',
              text: 'What is the current price of Bitcoin in USD as of today in 2025?',
            },
          },
        },
        async () => {
          await ingest()
          await agent()
        }
      )

      expect(chat.sentMessages).toHaveLength(1)

      const message = chat.sentMessages[0]!
      expect('text' in message).toBe(true)
      const responseText = 'text' in message ? message.text : ''
      expect(responseText).toMatch(/bitcoin/i)
      expect(responseText).toMatch(/USD|\$/i)
      expect(responseText).toMatch(/\d{4,6}/)
    },
    { timeout: 120000 }
  )

  test(
    'tracks web_search tool usage in usage_ledger and v_user_quota',
    async () => {
      // Verify initial state - no web_search usage recorded
      const initialLedger = await db.$client.query.usageLedger.findMany({
        where: (ledger, { and, eq }) =>
          and(eq(ledger.userId, seededUser.id), eq(ledger.key, 'n_web_search_calls_per_day')),
      })
      expect(initialLedger).toHaveLength(0)

      const initialQuota = await queryUserQuota(db, seededUser.id, 'n_web_search_calls_per_day')
      expect(initialQuota).toBeDefined()
      expect(initialQuota!.used).toBe(0)

      // Send a message that triggers web_search
      await runContext(
        {
          db,
          storage,
          chat,
          webSearch,
          user: seededUser,
          entitlements: seededEntitlements,
          notification: {
            userName: seededUser.name,
            userWaId: seededUser.waId,
            userPhone: seededUser.waId,
            timestamp: new Date(),
            message: {
              type: 'text',
              messageWaId: 'wamid.websearch.usage.1',
              text: 'What is the current price of Bitcoin in USD as of today in 2025?',
            },
          },
        },
        async () => {
          await ingest()
          await agent()
        }
      )

      // Verify usage_ledger has an entry for web_search
      const ledgerAfter = await db.$client.query.usageLedger.findMany({
        where: (ledger, { and, eq }) =>
          and(eq(ledger.userId, seededUser.id), eq(ledger.key, 'n_web_search_calls_per_day')),
      })
      expect(ledgerAfter.length).toBeGreaterThanOrEqual(1)
      expect(ledgerAfter[0]).toMatchObject({
        userId: seededUser.id,
        key: 'n_web_search_calls_per_day',
        value: 1,
      })

      // Verify v_user_quota shows used >= 1
      const quotaAfter = await queryUserQuota(db, seededUser.id, 'n_web_search_calls_per_day')
      expect(quotaAfter).toBeDefined()
      expect(quotaAfter!.used).toBeGreaterThanOrEqual(1)
    },
    { timeout: 120000 }
  )

  test(
    'tracks google_places tool usage in usage_ledger and v_user_quota',
    async () => {
      // Verify initial state - no google_places usage recorded
      const initialLedger = await db.$client.query.usageLedger.findMany({
        where: (ledger, { and, eq }) =>
          and(eq(ledger.userId, seededUser.id), eq(ledger.key, 'n_google_places_calls_per_day')),
      })
      expect(initialLedger).toHaveLength(0)

      const initialQuota = await queryUserQuota(db, seededUser.id, 'n_google_places_calls_per_day')
      expect(initialQuota).toBeDefined()
      expect(initialQuota!.used).toBe(0)

      // Send a message that triggers google_places
      await runContext(
        {
          db,
          storage,
          chat,
          webSearch,
          user: seededUser,
          entitlements: seededEntitlements,
          notification: {
            userName: seededUser.name,
            userWaId: seededUser.waId,
            userPhone: seededUser.waId,
            timestamp: new Date(),
            message: {
              type: 'text',
              messageWaId: 'wamid.places.usage.1',
              text: 'Send me the location of the Eiffel Tower',
            },
          },
        },
        async () => {
          await ingest()
          await agent()
        }
      )

      // Verify usage_ledger has an entry for google_places
      const ledgerAfter = await db.$client.query.usageLedger.findMany({
        where: (ledger, { and, eq }) =>
          and(eq(ledger.userId, seededUser.id), eq(ledger.key, 'n_google_places_calls_per_day')),
      })
      expect(ledgerAfter.length).toBe(1)
      expect(ledgerAfter[0]).toMatchObject({
        userId: seededUser.id,
        key: 'n_google_places_calls_per_day',
        value: 1,
      })

      // Verify v_user_quota shows used = 1
      const quotaAfter = await queryUserQuota(db, seededUser.id, 'n_google_places_calls_per_day')
      expect(quotaAfter).toBeDefined()
      expect(quotaAfter!.used).toBe(1)
    },
    { timeout: 120000 }
  )

  test(
    'tracks file storage usage in resource table and v_user_quota',
    async () => {
      // Verify initial state - no storage usage
      const initialResources = await db.$client.query.resource.findMany({
        where: (resource, { eq }) => eq(resource.userId, seededUser.id),
      })
      expect(initialResources).toHaveLength(0)

      const initialQuota = await queryUserQuota(db, seededUser.id, 'n_storage_size')
      expect(initialQuota).toBeDefined()
      expect(initialQuota!.used).toBe(0)

      // Send first image
      const imgBuffer = Uint8Array.fromBase64(imgBase64).buffer
      const imgSize = imgBuffer.byteLength

      await runContext(
        {
          db,
          storage,
          chat,
          webSearch,
          user: seededUser,
          entitlements: seededEntitlements,
          notification: {
            userName: seededUser.name,
            userWaId: seededUser.waId,
            userPhone: seededUser.waId,
            timestamp: new Date(),
            message: {
              type: 'image',
              messageWaId: 'wamid.storage.1',
              data: imgBuffer,
              mimeType: 'image/png',
            },
          },
        },
        async () => {
          await ingest()
          await agent()
        }
      )

      // Verify resource table has an entry with correct size
      const resourcesAfterFirst = await db.$client.query.resource.findMany({
        where: (resource, { eq }) => eq(resource.userId, seededUser.id),
      })
      expect(resourcesAfterFirst).toHaveLength(1)
      expect(resourcesAfterFirst[0]!.size).toBe(imgSize)

      // Verify v_user_quota shows used = imgSize
      const quotaAfterFirst = await queryUserQuota(db, seededUser.id, 'n_storage_size')
      expect(quotaAfterFirst).toBeDefined()
      expect(quotaAfterFirst!.used).toBe(imgSize)

      // Send second image (different hash by adding timestamp to force new resource)
      const secondImgData = new Uint8Array(imgBuffer.byteLength + 8)
      secondImgData.set(new Uint8Array(imgBuffer), 0)
      new DataView(secondImgData.buffer).setBigUint64(imgBuffer.byteLength, BigInt(Date.now()))
      const secondImgBuffer = secondImgData.buffer
      const secondImgSize = secondImgBuffer.byteLength

      await runContext(
        {
          db,
          storage,
          chat,
          webSearch,
          user: seededUser,
          entitlements: seededEntitlements,
          notification: {
            userName: seededUser.name,
            userWaId: seededUser.waId,
            userPhone: seededUser.waId,
            timestamp: new Date(),
            message: {
              type: 'image',
              messageWaId: 'wamid.storage.2',
              data: secondImgBuffer,
              mimeType: 'image/png',
            },
          },
        },
        async () => {
          await ingest()
          await agent()
        }
      )

      // Verify resource table has two entries
      const resourcesAfterSecond = await db.$client.query.resource.findMany({
        where: (resource, { eq }) => eq(resource.userId, seededUser.id),
      })
      expect(resourcesAfterSecond).toHaveLength(2)

      // Verify v_user_quota shows cumulative storage usage
      const quotaAfterSecond = await queryUserQuota(db, seededUser.id, 'n_storage_size')
      expect(quotaAfterSecond).toBeDefined()
      expect(quotaAfterSecond!.used).toBe(imgSize + secondImgSize)
    },
    { timeout: 120000 }
  )

  test(
    'embeds text messages',
    async () => {
      const text = 'Hello.'
      await runContext(
        {
          db,
          storage,
          chat,
          webSearch,
          user: seededUser,
          entitlements: seededEntitlements,
          notification: {
            userName: seededUser.name,
            userWaId: seededUser.waId,
            userPhone: seededUser.waId,
            timestamp: new Date(),
            message: {
              type: 'text',
              messageWaId: 'wamid.1',
              text,
            },
          },
        },
        async () => {
          await ingest()
          await agent()
        }
      )

      const snippets = await db.$client.query.snippet.findMany()
      expect(snippets.length).toBe(2)

      expect(snippets[0]!.content).toBe(text)
    },
    { timeout: 120000 }
  )

  test(
    'embeds image description containing "hello world"',
    async () => {
      const imgBuffer = Uint8Array.fromBase64(imgBase64).buffer
      await runContext(
        {
          db,
          storage,
          chat,
          webSearch,
          user: seededUser,
          entitlements: seededEntitlements,
          notification: {
            userName: seededUser.name,
            userWaId: seededUser.waId,
            userPhone: seededUser.waId,
            timestamp: new Date(),
            message: {
              type: 'image',
              messageWaId: 'wamid.1',
              data: imgBuffer,
              mimeType: 'image/png',
            },
          },
        },
        async () => {
          await ingest()
          await agent()
        }
      )

      const snippets = await db.$client.query.snippet.findMany()
      expect(snippets.length).toBe(2)

      expect(snippets[0]!.content).toMatch(/hello.*world/i)
    },
    { timeout: 120000 }
  )

  test(
    'uses search_conversation_history tool to recall stored memory and writes base fixture',
    async () => {
      const originalMaxRecent = import.meta.env.MAX_RECENT_MESSAGES
      import.meta.env.MAX_RECENT_MESSAGES = '4'

      try {
        const fs = await import('node:fs/promises')
        const fixtureDir = `./packages/agent/zapid/__fixtures__`
        const fixturePath = `${fixtureDir}/search_conversation_history_dump.sql`

        let hasFixture = false
        try {
          await fs.access(fixturePath)
          hasFixture = true
        } catch {
          hasFixture = false
        }

        if (hasFixture) {
          const sql = await fs.readFile(fixturePath, 'utf8')
          // Seed database with existing fixture for deterministic state
          await db.$client.execute(sql)
        }

        const run = async (text: string) => {
          await runContext(
            {
              db,
              storage,
              chat,
              webSearch,
              user: seededUser,
              entitlements: seededEntitlements,
              notification: {
                userName: seededUser.name,
                userWaId: seededUser.waId,
                userPhone: seededUser.waId,
                timestamp: new Date(),
                message: {
                  type: 'text',
                  messageWaId: `wamid.memory.${Date.now()}`,
                  text,
                },
              },
            },
            async () => {
              await ingest()
              await agent()
            }
          )
        }

        if (!hasFixture) {
          // 1–3: seed memory and general context only when fixture does not exist
          await run('The secret door code is 4242.')
          await run('How are you?')
          await run('Thanks!')

          // Dump base SQL fixture after the first three messages
          const messagesAfterThree = await db.$client.query.message.findMany()
          const snippetsAfterThree = await db.$client.query.snippet.findMany()
          const usersAfterThree = await db.$client.query.user.findMany()

          await fs.mkdir(fixtureDir, { recursive: true })

          const sqlLines: string[] = []

          // Users first (FK target for message.user_id)
          for (const u of usersAfterThree) {
            sqlLines.push(
              `INSERT INTO "user" ("id", "waId", "name", "joinedAt") VALUES (` +
                `${esc(u.id)}, ` +
                `${esc(u.waId)}, ` +
                `${esc(u.name)}, ` +
                `${u.joinedAt ? esc(u.joinedAt.toISOString()) : 'NOW()'}::timestamptz` +
                `);`
            )
          }

          // Messages next
          for (const m of messagesAfterThree) {
            sqlLines.push(
              `INSERT INTO "message" ("id", "userId", "waId", "type", "modelMessage", "usageInputTokens", "usageOutputTokens", "usageTotalTokens", "usageCachedInputTokens", "usageReasoningTokens", "resourceId", "timestamp") VALUES (` +
                `${esc(m.id)}, ` +
                `${esc(m.userId)}, ` +
                `${m.waId ? esc(m.waId) : 'NULL'}, ` +
                `${esc(m.type)}, ` +
                `${esc(JSON.stringify(m.modelMessage))}, ` +
                `${m.usageInputTokens ?? 'NULL'}, ` +
                `${m.usageOutputTokens ?? 'NULL'}, ` +
                `${m.usageTotalTokens ?? 'NULL'}, ` +
                `${m.usageCachedInputTokens ?? 'NULL'}, ` +
                `${m.usageReasoningTokens ?? 'NULL'}, ` +
                `${m.resourceId ? esc(m.resourceId) : 'NULL'}, ` +
                `${m.timestamp ? esc(m.timestamp.toISOString()) : 'NOW()'}::timestamptz` +
                `);`
            )
          }

          // Snippets last (FK target for snippet.message_id)
          for (const s of snippetsAfterThree) {
            sqlLines.push(
              `INSERT INTO "snippet" ("id", "messageId", "sequence", "content", "vector") VALUES (` +
                `${esc(s.id)}, ` +
                `${esc(s.messageId)}, ` +
                `${s.sequence}, ` +
                `${esc(s.content)}, ` +
                `'[${s.vector.join(',')}]'::vector` +
                `);`
            )
          }

          await fs.writeFile(fixturePath, sqlLines.join('\n') + '\n', 'utf8')
        }

        // 4: ask to recall the secret code
        await run(
          'I forgot the secret door code I told you earlier. Please answer only with the 4 digits.'
        )

        const allMessages = await db.$client.query.message.findMany()

        const hasSearchConversationHistoryCall = allMessages.some((m) => {
          if (m.type !== 'tool-call') return false
          const modelMessage = m.modelMessage as any
          if (modelMessage.toolName === 'search_conversation_history') return true
          if (Array.isArray(modelMessage.content)) {
            return modelMessage.content.some(
              (c: any) => c.type === 'tool-call' && c.toolName === 'search_conversation_history'
            )
          }
          if (Array.isArray(modelMessage.toolCalls)) {
            return modelMessage.toolCalls.some(
              (tc: any) => tc.name === 'search_conversation_history'
            )
          }
          return false
        })

        expect(hasSearchConversationHistoryCall).toBe(true)

        expect(chat.sentMessages).not.toHaveLength(0)
        const responseMessage = chat.sentMessages.at(-1)!
        expect('text' in responseMessage).toBe(true)
        const responseText = 'text' in responseMessage ? responseMessage.text : ''
        expect(responseText.replace(/\D/g, '')).toContain('4242')
      } finally {
        import.meta.env.MAX_RECENT_MESSAGES = originalMaxRecent
      }
    },
    { timeout: 120000 }
  )

  test(
    'uses search_files tool to retrieve a previously sent image',
    async () => {
      const originalMaxRecent = import.meta.env.MAX_RECENT_MESSAGES
      import.meta.env.MAX_RECENT_MESSAGES = '1'
      try {
        const imgBuffer = Uint8Array.fromBase64(imgBase64).buffer

        // First: send the image
        await runContext(
          {
            db,
            storage,
            chat,
            webSearch,
            user: seededUser,
            entitlements: seededEntitlements,
            notification: {
              userName: seededUser.name,
              userWaId: seededUser.waId,
              userPhone: seededUser.waId,
              timestamp: new Date(),
              message: {
                type: 'image',
                messageWaId: 'wamid.file.1',
                data: imgBuffer,
                mimeType: 'image/png',
              },
            },
          },
          async () => {
            await ingest()
            await agent()
          }
        )

        // Second: ask to retrieve the image
        await runContext(
          {
            db,
            storage,
            chat,
            webSearch,
            user: seededUser,
            entitlements: seededEntitlements,
            notification: {
              userName: seededUser.name,
              userWaId: seededUser.waId,
              userPhone: seededUser.waId,
              timestamp: new Date(),
              message: {
                type: 'text',
                messageWaId: 'wamid.file.2',
                text: 'Send me the Hello World image I sent you. Send it directly without transformation.',
              },
            },
          },
          async () => {
            await ingest()
            await agent()
          }
        )

        // Verify search_files tool was called
        const allMessages = await db.$client.query.message.findMany()
        const hasSearchFilesCall = allMessages.some((m) => {
          if (m.type !== 'tool-call') return false
          const modelMessage = m.modelMessage as {
            toolName?: string
            content?: Array<{ type: string; toolName?: string }>
            toolCalls?: Array<{ name: string }>
          }
          if (modelMessage.toolName === 'search_files') return true
          if (Array.isArray(modelMessage.content)) {
            return modelMessage.content.some(
              (c) => c.type === 'tool-call' && c.toolName === 'search_files'
            )
          }
          if (Array.isArray(modelMessage.toolCalls)) {
            return modelMessage.toolCalls.some((tc) => tc.name === 'search_files')
          }
          return false
        })

        expect(hasSearchFilesCall).toBe(true)

        // Verify image was sent back
        const imageMessages = chat.sentMessages.filter((msg) => 'data' in msg && msg.data)
        expect(imageMessages.length).toBeGreaterThanOrEqual(1)

        // Compare binaries
        const sentImage = imageMessages.at(-1) as { data: ArrayBuffer }
        const originalBytes = new Uint8Array(imgBuffer)
        const returnedBytes = new Uint8Array(sentImage.data)

        expect(returnedBytes.length).toBe(originalBytes.length)
        expect(returnedBytes).toEqual(originalBytes)
      } finally {
        import.meta.env.MAX_RECENT_MESSAGES = originalMaxRecent
      }
    },
    { timeout: 120000 }
  )

  test(
    'uses update_user_profile tool to store user preferences',
    async () => {
      await runContext(
        {
          db,
          storage,
          chat,
          webSearch,
          user: seededUser,
          entitlements: seededEntitlements,
          notification: {
            userName: seededUser.name,
            userWaId: seededUser.waId,
            userPhone: seededUser.waId,
            timestamp: new Date(),
            message: {
              type: 'text',
              messageWaId: 'wamid.profile.1',
              text: 'Meu nome é João e prefiro respostas em português. Moro na cidade de Fortaleza.',
            },
          },
        },
        async () => {
          await ingest()
          await agent()
        }
      )

      const allMessages = await db.$client.query.message.findMany()
      const hasUpdateUserProfileCall = allMessages.some((m) => {
        if (m.type !== 'tool-call') return false
        const modelMessage = m.modelMessage as {
          toolName?: string
          content?: Array<{ type: string; toolName?: string }>
          toolCalls?: Array<{ name: string }>
        }
        if (modelMessage.toolName === 'update_user_profile') return true
        if (Array.isArray(modelMessage.content)) {
          return modelMessage.content.some(
            (c) => c.type === 'tool-call' && c.toolName === 'update_user_profile'
          )
        }
        if (Array.isArray(modelMessage.toolCalls)) {
          return modelMessage.toolCalls.some((tc) => tc.name === 'update_user_profile')
        }
        return false
      })

      expect(hasUpdateUserProfileCall).toBe(true)

      const users = await db.$client.query.user.findMany()
      expect(users.length).toBe(1)

      const [userProfile] = await db.$client.query.userProfileVersion.findMany()
      expect(userProfile?.profile).toMatch(/mauro/i)
      expect(userProfile?.profile).toMatch(/portuguese/i)
      expect(userProfile?.profile).toMatch(/fortaleza/i)
    },
    { timeout: 120000 }
  )

  test(
    'acknowledges inability to generate images, audio, video, or documents',
    async () => {
      const run = async (text: string) => {
        await runContext(
          {
            db,
            storage,
            chat,
            webSearch,
            user: seededUser,
            entitlements: seededEntitlements,
            notification: {
              userName: seededUser.name,
              userWaId: seededUser.waId,
              userPhone: seededUser.waId,
              timestamp: new Date(),
              message: {
                type: 'text',
                messageWaId: `wamid.capabilities.${Date.now()}`,
                text,
              },
            },
          },
          async () => {
            await ingest()
            await agent()
          }
        )
      }

      await run('Can you generate an image of a sunset for me?')
      const imageResponse = chat.sentMessages.at(-1)!
      expect('text' in imageResponse).toBe(true)
      const imageResponseText = 'text' in imageResponse ? imageResponse.text : ''
      expect(imageResponseText).toMatch(/can.?t|cannot|unable|don.?t|not able|no/i)

      await run('Can you create an audio file or voice recording for me?')
      const audioResponse = chat.sentMessages.at(-1)!
      expect('text' in audioResponse).toBe(true)
      const audioResponseText = 'text' in audioResponse ? audioResponse.text : ''
      expect(audioResponseText).toMatch(/can.?t|cannot|unable|don.?t|not able|no/i)

      await run('Can you watch and analyze a video for me?')
      const videoResponse = chat.sentMessages.at(-1)!
      expect('text' in videoResponse).toBe(true)
      const videoResponseText = 'text' in videoResponse ? videoResponse.text : ''
      expect(videoResponseText).toMatch(/can.?t|cannot|unable|don.?t|not able|no/i)

      await run('Can you create a PDF or Word document for me?')
      const docResponse = chat.sentMessages.at(-1)!
      expect('text' in docResponse).toBe(true)
      const docResponseText = 'text' in docResponse ? docResponse.text : ''
      expect(docResponseText).toMatch(/can.?t|cannot|unable|don.?t|not able|no/i)

      await run('Can you make a phone call to my friend for me?')
      const phoneResponse = chat.sentMessages.at(-1)!
      expect('text' in phoneResponse).toBe(true)
      const phoneResponseText = 'text' in phoneResponse ? phoneResponse.text : ''
      expect(phoneResponseText).toMatch(/can.?t|cannot|unable|don.?t|not able|no/i)

      await run('Can you send an email to john@example.com for me?')
      const emailResponse = chat.sentMessages.at(-1)!
      expect('text' in emailResponse).toBe(true)
      const emailResponseText = 'text' in emailResponse ? emailResponse.text : ''
      expect(emailResponseText).toMatch(/can.?t|cannot|unable|don.?t|not able|no/i)

      await run('Can you run this Python code for me: print("hello")')
      const codeResponse = chat.sentMessages.at(-1)!
      expect('text' in codeResponse).toBe(true)
      const codeResponseText = 'text' in codeResponse ? codeResponse.text : ''
      expect(codeResponseText).toMatch(/can.?t|cannot|unable|don.?t|not able|no/i)

      await run('Can you buy me a pizza from Dominos and pay with my credit card?')
      const purchaseResponse = chat.sentMessages.at(-1)!
      expect('text' in purchaseResponse).toBe(true)
      const purchaseResponseText = 'text' in purchaseResponse ? purchaseResponse.text : ''
      expect(purchaseResponseText).toMatch(/can.?t|cannot|unable|don.?t|not able|no/i)
    },
    { timeout: 480000 }
  )
})

const esc = (value: string) => `'${value.replace(/'/g, "''")}'`
