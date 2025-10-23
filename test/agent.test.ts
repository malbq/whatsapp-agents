import { createClient, type Client } from '@libsql/client'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  jest,
  mock,
  test,
} from 'bun:test'
import { agent } from '../src/agent'
import type { IncomingMessage } from '../src/infra/chat'
import type { DB } from '../src/infra/db'
import { LibSql } from '../src/infra/dbLibSql'
import type { Storage } from '../src/infra/storage'
import { FilesystemStorage } from '../src/infra/storageFilesystem'

const originalEnv = Object.assign({}, import.meta.env)

const dbPath = `/tmp/agent-test-${Date.now()}.db`
const storagePath = `/tmp/agent-test-${Date.now()}`
let db: DB
let storage: Storage
let dbClient: Client
let deps: TestDeps

const imageAnalysisResult = 'image analysis result'
const aiTextResponse = 'mock response'
const audioTranscriptionResult = 'transcribed audio text'
const documentTranscriptionResult = 'document transcription result'
const mockEmbeddings = Array.from({ length: 384 }, () => Math.random())
let messageExternalId = 0

beforeAll(async () => {
  await Bun.$`mkdir -p ${storagePath}`.nothrow()
  storage = FilesystemStorage.storage(storagePath)
  dbClient = createClient({ url: `file:${dbPath}` })
  db = LibSql.db(dbClient)
  await Bun.$`atlas schema apply --env local --url sqlite://file:${dbPath} --auto-approve`.quiet()

  deps = {
    db: {
      findRecentMessages: mock(db.findRecentMessages),
      persistUser: mock(db.persistUser),
      updateUserProfile: mock(db.updateUserProfile),
      updateProfileVersionMessageId: mock(db.updateProfileVersionMessageId),
      storeMessage: mock(db.storeMessage),
      storeWebhookEvent: mock(db.storeWebhookEvent),
      findSimilarMessages: mock(db.findSimilarMessages),
      searchFiles: mock(db.searchFiles),
      findStorageKeyById: mock(db.findStorageKeyById),
      createReminder: mock(db.createReminder),
      cancelReminder: mock(db.cancelReminder),
      listUpcomingReminders: mock(db.listUpcomingReminders),
      takeDueReminders: mock(db.takeDueReminders),
      markReminderSent: mock(db.markReminderSent),
      markReminderFailed: mock(db.markReminderFailed),
    },
    chat: {
      parseNotification: mock(),
      acknowledgeMessage: mock(),
      sendText: mock(async () => `${messageExternalId++}`),
      sendImage: mock(async () => `${messageExternalId++}`),
      sendDocument: mock(async () => `${messageExternalId++}`),
      sendLocation: mock(async () => `${messageExternalId++}`),
      sendReaction: mock(async () => `${messageExternalId++}`),
      sendContact: mock(async () => `${messageExternalId++}`),
      sendInteractiveList: mock(async () => `${messageExternalId++}`),
      sendInteractiveButton: mock(async () => `${messageExternalId++}`),
      sendInteractiveCtaUrl: mock(async () => `${messageExternalId++}`),
      sendTemplate: mock(async () => `${messageExternalId++}`),
    },
    ai: {
      analyzeImage: mock(async () => imageAnalysisResult),
      respond: mock(async () => ({
        stream: (async function* () {
          yield aiTextResponse
        })(),
      })),
      transcribeAudio: mock(async () => audioTranscriptionResult),
      transcribeDocument: mock(async () => documentTranscriptionResult),
      generateEmbeddings: mock(async (texts: string[]) =>
        texts.map((text) => [{ content: text, embedding: mockEmbeddings }])
      ),
    },
    storage: {
      store: mock(storage.store),
      retrieve: mock(storage.retrieve),
    },
  }
})

beforeEach(async () => {
  messageExternalId = 0
})

afterEach(async () => {
  jest.clearAllMocks()
  await dbClient.executeMultiple(`
    DELETE FROM user;
    DELETE FROM message;
    DELETE FROM raw_incoming_message;
  `)
  await Bun.$`find ${storagePath} -mindepth 1 -delete`.nothrow()
  Object.assign(import.meta.env, originalEnv)
})

afterAll(async () => {
  try {
    await Bun.$`rm -f ${dbPath}`.nothrow()
    await Bun.$`rm -rf ${storagePath}`.nothrow()
  } catch (error) {
    console.warn('Cleanup error:', error)
  }
})

describe('Smoke test: first interaction', () => {
  test('Text message', async () => {
    const message: IncomingMessage = {
      userExternalId: 'user-external-id',
      userName: 'Test User',
      externalId: 'user-msg-external-id',
      type: 'text',
      text: 'Hello, this is a test message',
    }

    await agent(deps, message)

    expect(deps.chat.acknowledgeMessage).toHaveBeenCalled()
    expect(deps.storage.store).not.toHaveBeenCalled()

    expect(deps.chat.sendText.mock.calls[0]?.[0]).toEqual({ text: aiTextResponse })

    const user = await getUserWithProfileFromDatabase(message.userExternalId)
    const messages = await getUserMessagesFromDatabase(user.id)

    expect(messages).toEqual([
      expect.objectContaining({
        external_id: message.externalId,
        user_id: user.id,
        role: 'user',
        type: 'text',
        content: message.text,
      }),
      expect.objectContaining({
        external_id: `${messageExternalId - 1}`,
        user_id: user.id,
        role: 'assistant',
        type: 'text',
        content: aiTextResponse,
      }),
    ])

    expect(user).toMatchObject({
      name: message.userName,
      external_id: message.userExternalId,
    })
  })

  test('Voice recording', async () => {
    const message: IncomingMessage = {
      userExternalId: 'user-external-id',
      userName: 'Test User',
      externalId: 'user-msg-external-id',
      type: 'voice',
      mediaData: new ArrayBuffer(1024),
      mimeType: 'audio/ogg',
    }

    await agent(deps, message)

    expect(deps.chat.acknowledgeMessage).toHaveBeenCalled()
    expect(deps.chat.sendText.mock.calls[0]?.[0]).toEqual({
      text: aiTextResponse,
    })

    const user = await getUserWithProfileFromDatabase(message.userExternalId)
    const messages = await getUserMessagesFromDatabase(user.id)

    expect(messages).toEqual([
      expect.objectContaining({
        external_id: message.externalId,
        user_id: user.id,
        role: 'user',
        type: 'voice',
        content: audioTranscriptionResult,
      }),
      expect.objectContaining({
        external_id: `${messageExternalId - 1}`,
        user_id: user.id,
        role: 'assistant',
        type: 'text',
        content: aiTextResponse,
      }),
    ])

    expect(user).toMatchObject({
      name: message.userName,
      external_id: message.userExternalId,
    })
  })

  test('Audio (not voice recording)', async () => {
    const message: IncomingMessage = {
      userExternalId: 'user-external-id',
      userName: 'Test User',
      externalId: 'user-msg-external-id',
      type: 'audio',
      mediaData: new ArrayBuffer(1024),
      mimeType: 'audio/ogg',
    }

    await agent(deps, message)

    expect(deps.chat.acknowledgeMessage).toHaveBeenCalled()
    expect(deps.chat.sendText).toHaveBeenCalledWith({ text: aiTextResponse })

    const user = await getUserWithProfileFromDatabase(message.userExternalId)
    const messages = await getUserMessagesFromDatabase(user.id)

    expect(messages).toEqual([
      expect.objectContaining({
        external_id: `${message.externalId}`,
        user_id: user.id,
        role: 'user',
        type: 'audio',
        content: audioTranscriptionResult,
      }),
      expect.objectContaining({
        user_id: user.id,
        role: 'assistant',
        type: 'text',
        content: aiTextResponse,
      }),
    ])

    expect(user).toMatchObject({
      name: message.userName,
      external_id: message.userExternalId,
    })
  })

  test('Image with caption', async () => {
    const message: IncomingMessage = {
      userExternalId: 'user-external-id',
      userName: 'Test User',
      externalId: 'user-msg-external-id',
      type: 'image',
      mediaData: new ArrayBuffer(1024),
      mimeType: 'image/jpeg',
      text: 'A beautiful sunset',
    }

    await agent(deps, message)
    expect(deps.chat.acknowledgeMessage).toHaveBeenCalled()
    expect(deps.chat.sendText.mock.calls[0]?.[0]).toEqual({ text: aiTextResponse })

    const user = await getUserWithProfileFromDatabase(message.userExternalId)
    const messages = await getUserMessagesFromDatabase(user.id)
    const imageMessage = messages.find((m) => m.type === 'image')!

    expect(
      await Bun.file(`${storagePath}/${imageMessage.media_storage_key}`).arrayBuffer()
    ).toEqual(message.mediaData!)

    expect(messages).toEqual([
      expect.objectContaining({
        user_id: user.id,
        role: 'user',
        type: 'image',
        content: imageAnalysisResult,
        media_storage_key: imageMessage.media_storage_key,
      }),
      expect.objectContaining({
        external_id: message.externalId,
        user_id: user.id,
        role: 'user',
        type: 'text',
        content: message.text,
      }),
      expect.objectContaining({
        user_id: user.id,
        role: 'assistant',
        type: 'text',
        content: aiTextResponse,
      }),
    ])

    expect(user).toMatchObject({
      name: message.userName,
      external_id: message.userExternalId,
    })
  })

  test('Image without caption', async () => {
    const message: IncomingMessage = {
      userExternalId: 'user-external-id',
      userName: 'Test User',
      externalId: 'user-msg-external-id',
      type: 'image',
      mediaData: new ArrayBuffer(1024),
      mimeType: 'image/jpeg',
    }

    await agent(deps, message)

    expect(deps.chat.acknowledgeMessage).toHaveBeenCalled()
    expect(deps.chat.sendText.mock.calls[0]?.[0]).toEqual({ text: aiTextResponse })

    const user = await getUserWithProfileFromDatabase(message.userExternalId)
    const messages = await getUserMessagesFromDatabase(user.id)
    const imageMessage = messages.find((m) => m.type === 'image')!

    expect(
      await Bun.file(`${storagePath}/${imageMessage.media_storage_key}`).arrayBuffer()
    ).toEqual(message.mediaData!)

    expect(messages).toEqual([
      expect.objectContaining({
        external_id: message.externalId,
        user_id: user.id,
        role: 'user',
        type: 'image',
        content: imageAnalysisResult,
        media_storage_key: imageMessage.media_storage_key,
      }),
      expect.objectContaining({
        user_id: user.id,
        role: 'assistant',
        type: 'text',
        content: aiTextResponse,
      }),
    ])

    expect(user).toMatchObject({
      name: message.userName,
      external_id: message.userExternalId,
      profile: null,
      profile_updated_by: null,
    })
  })

  test('Document', async () => {
    const message: IncomingMessage = {
      userExternalId: 'user-external-id',
      userName: 'Test User',
      externalId: 'user-msg-external-id',
      type: 'document',
      mediaData: new ArrayBuffer(1024),
      mimeType: 'application/pdf',
      documentFilename: 'test-document.pdf',
    }

    await agent(deps, message)

    expect(deps.chat.acknowledgeMessage).toHaveBeenCalled()
    expect(deps.chat.sendText.mock.calls[0]?.[0]).toEqual({ text: aiTextResponse })

    const user = await getUserWithProfileFromDatabase(message.userExternalId)
    const messages = await getUserMessagesFromDatabase(user.id)
    const documentMessage = messages.find((m) => m.type === 'document')!

    expect(
      await Bun.file(`${storagePath}/${documentMessage.media_storage_key}`).arrayBuffer()
    ).toEqual(message.mediaData!)

    expect(messages).toEqual([
      expect.objectContaining({
        user_id: user.id,
        role: 'user',
        type: 'document',
        content: documentTranscriptionResult,
        media_storage_key: documentMessage.media_storage_key,
      }),
      expect.objectContaining({
        user_id: user.id,
        role: 'assistant',
        type: 'text',
        content: aiTextResponse,
      }),
    ])

    expect(user).toMatchObject({
      name: message.userName,
      external_id: message.userExternalId,
      profile: null,
      profile_updated_by: null,
    })
  })
})

async function getUserMessagesFromDatabase(userId: string) {
  return (
    await dbClient.execute({
      sql: `
      SELECT m.*, GROUP_CONCAT(e.content, '') as content
      FROM message m
      JOIN embedding e ON m.id = e.message_id
      WHERE m.user_id = ?
      GROUP BY e.message_id
      ORDER BY m.id, e.sequence`,
      args: [userId],
    })
  ).rows as unknown as Array<{
    id: string
    external_id: string
    role: string
    type: string
    user_id: string
    content: string
    media_storage_key?: string
  }>
}

async function getUserWithProfileFromDatabase(userExternalId: string) {
  return (
    await dbClient.execute({
      sql: `
        SELECT u.*, p.profile, p.message_id as profile_updated_by
        FROM user u
        LEFT JOIN user_profile_version p ON u.id = p.user_id
        WHERE u.external_id = ?
        ORDER BY p.id DESC
        LIMIT 1`,
      args: [userExternalId],
    })
  ).rows[0] as unknown as {
    id: string
    external_id: string
    name: string
    joined_at: string
    profile: string | null
    profile_updated_by: string | null
  }
}

// Duplicate content removed below. End of test file.
