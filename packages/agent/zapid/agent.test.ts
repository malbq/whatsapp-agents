import type { Storage } from '@batman/core/infra/storage'
import { FilesystemStorage } from '@batman/core/infra/storageFilesystem'
import type { WebSearch } from '@batman/core/infra/webSearch'
import { WebSearchBrave } from '@batman/core/infra/webSearchBrave'
import type { Chat, Notification } from '@batman/whatsapp'
import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'bun:test'
import { styleText } from 'node:util'
import { agent } from './agent'
import { runContext } from './context'
import { dbFactory, type ZapidRepository } from './db'

interface MockChat extends Chat {
  sentMessages: Array<{
    method: string
    userWaId: string
    message:
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
  }>
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
      sentMessages.push({ method: 'sendText', userWaId, message })
      return `msg_${sentMessages.length + 1}`
    },

    async sendImage(userWaId: string, message) {
      sentMessages.push({ method: 'sendImage', userWaId, message })
      return `msg_${sentMessages.length + 1}`
    },

    async sendDocument(userWaId: string, message) {
      sentMessages.push({ method: 'sendDocument', userWaId, message })
      return `msg_${sentMessages.length + 1}`
    },

    async sendLocation(userWaId: string, message) {
      sentMessages.push({ method: 'sendLocation', userWaId, message })
      return `msg_${sentMessages.length + 1}`
    },

    async sendReaction(userWaId: string, message) {
      sentMessages.push({ method: 'sendReaction', userWaId, message })
      return `msg_${sentMessages.length + 1}`
    },

    async sendContact(userWaId: string, message) {
      sentMessages.push({ method: 'sendContact', userWaId, message })
      return `msg_${sentMessages.length + 1}`
    },

    async sendInteractiveList(userWaId: string, message) {
      sentMessages.push({ method: 'sendInteractiveList', userWaId, message })
      return `msg_${sentMessages.length + 1}`
    },

    async sendInteractiveButton(userWaId: string, message) {
      sentMessages.push({ method: 'sendInteractiveButton', userWaId, message })
      return `msg_${sentMessages.length + 1}`
    },

    async sendInteractiveCtaUrl(userWaId: string, message) {
      sentMessages.push({ method: 'sendInteractiveCtaUrl', userWaId, message })
      return `msg_${sentMessages.length + 1}`
    },

    async sendTemplate(userWaId: string, message) {
      sentMessages.push({ method: 'sendTemplate', userWaId, message })
      return `msg_${sentMessages.length + 1}`
    },
  }
}

let testDbName: string | undefined
let testStorageDir: string
let db: ZapidRepository
let storage: Storage
let chat: MockChat
let webSearch: WebSearch

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
})

afterEach(async () => {
  if (testDbName) {
    await dropTestDatabase(testDbName)
  }
})

test(
  'Agent responds to a message',
  async () => {
    await runContext(
      {
        db,
        storage,
        chat,
        webSearch,
        notification: {
          userName: 'Test User',
          userWaId: '1234567890',
          userPhone: '+1234567890',
          timestamp: new Date(),
          message: {
            type: 'text',
            messageWaId: 'wamid.1',
            text: 'Hello',
          },
        },
      },
      async () => {
        await agent()
      }
    )

    expect(chat.sentMessages).toHaveLength(1)
    expect(chat.sentMessages[0]?.method).toBe('sendText')
    expect(chat.sentMessages[0]?.userWaId).toBe('1234567890')
    expect(chat.sentMessages[0]?.message).toMatchObject({
      text: expect.stringMatching(/(hi|hello|hey|greetings)/i),
    })
  },
  { timeout: 60000 }
)

const imgBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAMgAAABkCAAAAADm7SDXAAAAAmJLR0QA/4ePzL8AAAQaSURBVHja7dfrb1N1HMfxd9vdwMyh4eKQGUhjAoG5LREv6GIckoVYb8TxQGV1RhdnDDEMLDGQo+ESWUhGskznQsLFaAhOCg4FEiioWdhAYIQELRtuDmFstJ+/wQfnbG3nfLYtYL6/R99zTj/99ZWe3+97DvqfDAxiEIMYxCAGMYhBDGIQgxjEIAYxiEEMYhCDGMQgBjGIQQxiEIMYxCAGMciEQzpisQGv/DkWG8y82BkO75b2hMMd4yQHYrErXnnn1x6vunU69vv4E/0dDn+aOqoJr59gSBDavTIfujIvRqFW+gAOjpPsCcD3brmSXDd5ZwEcGH+iXngidZRF8K6BaBm8KUn6IwD1kqQTcN/gPQfZCrOTktQA3u/6GF7WPQe5APwiSeUAHZJUBi13EeT09kjD+X9Dho9sjezsTMsugs2SrgVYChFJ1/xkXZekoeiWyM5zkqTjezp19bPI5RFIoi2ybl9iKiBXygH8awbHQI4GAVjZM5qth2WSGuHHAhZJ+grKJenwfABCvZJCLD5dAK0eJL4U4Fn/5EN6i/BV1j0DNZmQYzn4iivnwsIbI9lTkNUvPc/c5Go4J1XBdkk/ZOMvqSyEJTelEHmPAlEXMlwGs19ZlsVkQNJGl/QuNElai/+3dEhyIeyThqvcm0iSlCyEverNplb7YZMSM6FbSgThW2noVdgkhSAQOXFo0IU0Q1mfdNw36ZDh+90p4tCQDjkJT0nS5QBFo+F34C01QbtuTuMxnYRiSce8G+yCn6AUgnWpxV4BbZO22HfF3DEdutQFBaWlpaWlsDYd0gAfSZKKYHSVtEFh8gVm3ZFegosb3X9rG2yQJM2BfoXgbAoyCwamZtc6Bbkz3LErHfIJbJO3w54fCd/Oh2M5VEtqgS1Pwhm3meyQJBVDt0LeXuhCspk2RdvvRVg+Xh/5HNyno/kQH/3Aa7ACvpPUl0N5HvOSbqPcKEl6GP4cA8nHNzg1kORMZtwYB/ITVEhSPJuHUulW8FNwW5Iq8EGtJB2BSkm6GuARjYEs8XroFPSROqgekoaamjMgwwvwHZVUCx+m0n3ZwGrJ7SYQlaShIvwnpGQN1I+F1MHrCSXeY/IhPfMg+MaqOfhPZfSRg35ylleXQNH1tPhzwNeSpHgAZgxJkr7xkbtizRKY3zcWcj4XFq8KkjMFnf1CCQB5kWRmZ9/7IABll9LjO2D6Lbd8Gqq8s7sfAODxyxoLUXM2kNvw4oRDGh1n5PVom+P0SlLyUH34/aa4pG7HiUqHHeeiJP31ZV14fTSZEY87TqtXtjvOmZHT/V/UhTccTkrSfu9bbzlOiyR1bnh78yWddRrtVdcgBjGIQQxiEIMYxCAGMYhBDGIQgxjEIAYxiEEMYhCDGMQgBjGIQQxiEIP81/gHl+a1TDJF6GIAAAAASUVORK5CYII='
test(
  'Agent describes a message',
  async () => {
    const imgBuffer = Uint8Array.fromBase64(imgBase64).buffer
    const user: Pick<Notification, 'userName' | 'userWaId' | 'userPhone'> = {
      userName: 'Test User',
      userWaId: '1234567890',
      userPhone: '1234567890',
    }
    await runContext(
      {
        db,
        storage,
        chat,
        webSearch,
        notification: {
          ...user,
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
        await agent()
      }
    )
    await runContext(
      {
        db,
        storage,
        chat,
        webSearch,
        notification: {
          ...user,
          timestamp: new Date(),
          message: {
            type: 'text',
            messageWaId: 'wamid.1',
            text: 'What is written on the image?',
          },
        },
      },
      async () => {
        await agent()
      }
    )

    expect(chat.sentMessages).toHaveLength(2)
    expect(chat.sentMessages.at(-1)?.message).toMatchObject({
      text: expect.stringMatching(/hello world/i),
    })
  },
  { timeout: 120000 }
)
