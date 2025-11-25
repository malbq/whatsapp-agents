import type { Storage } from '@batman/core/infra/storage'
import { FilesystemStorage } from '@batman/core/infra/storageFilesystem'
import type { WebSearch } from '@batman/core/infra/webSearch'
import { WebSearchBrave } from '@batman/core/infra/webSearchBrave'
import type { Chat, Notification } from '@batman/whatsapp'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { styleText } from 'node:util'
import { agent } from './agent'
import { runContext } from './context'
import { dbFactory, type ZapidRepository } from './db'

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
const user: Pick<Notification, 'userName' | 'userWaId' | 'userPhone'> = {
  userName: 'Test User',
  userWaId: '1234567890',
  userPhone: '1234567890',
}
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
          notification: {
            ...user,
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
      expect(chat.sentMessages[0]).toMatchObject({
        text: expect.stringMatching(/(hi|hello|hey|greetings)/i),
      })
    },
    { timeout: 60000 }
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
          notification: {
            ...user,
            timestamp: new Date(),
            message: {
              type: 'text',
              messageWaId: 'wamid.1',
              text: 'Open https://info.cern.ch/hypertext/WWW/People.html and list the people involved in the development of the World Wide Web.',
            },
          },
        },
        async () => {
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
          notification: {
            ...user,
            timestamp: new Date(),
            message: {
              type: 'text',
              messageWaId: 'wamid.1',
              text: 'Send me the location of the Eiffel Tower',
            },
          },
        },
        async () => {
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
      expect(address).toMatch(/gustave.*eiffel.*75007.*paris/i)
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
          notification: {
            ...user,
            timestamp: new Date(),
            message: {
              type: 'text',
              messageWaId: 'wamid.1',
              text: 'What is the phone number of the Bureau de Gustave Eiffel in Paris?',
            },
          },
        },
        async () => {
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
          notification: {
            ...user,
            timestamp: new Date(),
            message: {
              type: 'text',
              messageWaId: 'wamid.1',
              text: 'What is the current price of Bitcoin in USD as of today in 2025?',
            },
          },
        },
        async () => {
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
    'embeds text messages',
    async () => {
      const text = 'Hello.'
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
              text,
            },
          },
        },
        async () => {
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

      const snippets = await db.$client.query.snippet.findMany()
      expect(snippets.length).toBe(2)

      expect(snippets[0]!.content).toMatch(/hello.*world/i)
    },
    { timeout: 120000 }
  )

  test(
    'uses fetch_memory tool to recall stored memory and writes base fixture',
    async () => {
      const originalMaxRecent = import.meta.env.MAX_RECENT_MESSAGES
      import.meta.env.MAX_RECENT_MESSAGES = '4'

      try {
        const fs = await import('node:fs/promises')
        const fixtureDir = `./packages/agent/zapid/__fixtures__`
        const fixturePath = `${fixtureDir}/fetch_memory_dump.sql`

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
              notification: {
                ...user,
                timestamp: new Date(),
                message: {
                  type: 'text',
                  messageWaId: `wamid.memory.${Date.now()}`,
                  text,
                },
              },
            },
            async () => {
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

          const esc = (value: string) => `'${value.replace(/'/g, "''")}'`

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

        const hasFetchMemoryCall = allMessages.some((m) => {
          if (m.type !== 'tool-call') return false
          const modelMessage = m.modelMessage as any
          if (modelMessage.toolName === 'fetch_memory') return true
          if (Array.isArray(modelMessage.content)) {
            return modelMessage.content.some(
              (c: any) => c.type === 'tool-call' && c.toolName === 'fetch_memory'
            )
          }
          if (Array.isArray(modelMessage.toolCalls)) {
            return modelMessage.toolCalls.some((tc: any) => tc.name === 'fetch_memory')
          }
          return false
        })

        expect(hasFetchMemoryCall).toBe(true)

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
})
