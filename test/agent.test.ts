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
import type { UserComponent } from '../src/agent/components'
import type { IncomingMessage } from '../src/infra/chat'
import type { DB } from '../src/infra/db'
import { LibSql } from '../src/infra/dbLibSql'
import type { Storage } from '../src/infra/storage'
import { FilesystemStorage } from '../src/infra/storageFilesystem'
import * as Prompt from '../src/prompts/prompt'

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
const updatedProfile = 'updated profile'
const mockEmbeddings = Array.from({ length: 384 }, () => Math.random())
let messageExternalId = 0

beforeAll(async () => {
  await Bun.$`mkdir -p ${storagePath} 2>/dev/null`
  storage = FilesystemStorage.storage(storagePath)
  dbClient = createClient({ url: `file:${dbPath}` })
  db = LibSql.db(dbClient)
  await Bun.$`bun run ./src/infra/dbSetup/init.ts ${dbPath}`

  deps = {
    db: {
      findRecentMessages: mock(db.findRecentMessages),
      persistUser: mock(db.persistUser),
      updateUserProfile: mock(db.updateUserProfile),
      storeMessage: mock(db.storeMessage),
      storeWebhookEvent: mock(db.storeWebhookEvent),
      findSimilarMessages: mock(db.findSimilarMessages),
    },
    chat: {
      parseNotification: mock(),
      acknowledgeProcessingMessage: mock(),
      sendTextMessage: mock(async () => `${messageExternalId++}`),
    },
    ai: {
      analyzeImage: mock(async () => imageAnalysisResult),
      respond: mock(async () => aiTextResponse),
      transcribeAudio: mock(async () => audioTranscriptionResult),
      transcribeDocument: mock(async () => documentTranscriptionResult),
      improveUserProfile: mock(async () => updatedProfile),
      generateEmbeddings: mock(async ({ text }: { text: string[] }) =>
        text.map(() => mockEmbeddings)
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
  await Bun.$`find ${storagePath} -mindepth 1 -delete 2>/dev/null`
  Object.assign(import.meta.env, originalEnv)
})

afterAll(async () => {
  try {
    await Bun.$`rm -f ${dbPath} 2>/dev/null`
    await Bun.$`rm -rf ${storagePath} 2>/dev/null`
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
    const result = await agent(deps, message)
    expect(result).toBeUndefined()
    expect(deps.db.persistUser).toHaveBeenCalledWith({
      externalId: message.userExternalId,
      name: message.userName,
    })
    const persistedUser = (await deps.db.persistUser.mock.results[0]?.value) as UserComponent
    expect(persistedUser).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        externalId: message.userExternalId,
        name: message.userName,
        joinedAt: expect.any(Date),
        profile: '',
      })
    )
    expect(deps.chat.acknowledgeProcessingMessage).toHaveBeenCalled()
    expect(deps.ai.respond).toHaveBeenCalledWith({
      messages: [{ role: 'user', content: message.text }],
    })
    expect(deps.chat.sendTextMessage).toHaveBeenCalledWith({ text: aiTextResponse })
    expect(deps.storage.store).not.toHaveBeenCalled()
    expect(deps.ai.generateEmbeddings.mock.calls[0]?.[0]).toEqual({
      text: [message.text],
    })
    expect(deps.ai.generateEmbeddings.mock.calls[1]?.[0]).toEqual({
      text: [aiTextResponse],
    })
    expect(deps.db.storeMessage.mock.calls[0]?.[0]).toEqual([
      {
        externalId: message.externalId,
        userId: persistedUser.id,
        role: 'user',
        type: 'text',
        content: [
          {
            content: message.text,
            embedding: mockEmbeddings,
          },
        ],
      },
      {
        externalId: `${messageExternalId - 1}`,
        userId: persistedUser.id,
        role: 'assistant',
        type: 'text',
        content: [
          {
            content: aiTextResponse,
            embedding: mockEmbeddings,
          },
        ],
      },
    ])
    expect(deps.db.updateUserProfile.mock.calls[0]?.[0]).toEqual({
      userId: persistedUser.id,
      profile: updatedProfile,
      messageId: (await deps.db.storeMessage.mock.results[0].value)?.[0],
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

    const result = await agent(deps, message)
    expect(result).toBeUndefined()

    expect(deps.db.persistUser).toHaveBeenCalledWith({
      externalId: message.userExternalId,
      name: message.userName,
    })
    const persistedUser = (await deps.db.persistUser.mock.results[0]?.value) as UserComponent

    expect(deps.chat.acknowledgeProcessingMessage).toHaveBeenCalled()
    expect(deps.ai.transcribeAudio).toHaveBeenCalledWith({ audio: message.mediaData })
    expect(deps.ai.respond).toHaveBeenCalledWith({
      messages: [{ role: 'user', content: audioTranscriptionResult }],
    })
    expect(deps.chat.sendTextMessage).toHaveBeenCalledWith({ text: aiTextResponse })
    expect(deps.storage.store).not.toHaveBeenCalled()
    expect(deps.ai.generateEmbeddings.mock.calls[0]?.[0]).toEqual({
      text: [audioTranscriptionResult],
    })
    expect(deps.ai.generateEmbeddings.mock.calls[1]?.[0]).toEqual({
      text: [aiTextResponse],
    })
    expect(deps.db.storeMessage.mock.calls[0]?.[0]).toEqual([
      {
        externalId: message.externalId,
        userId: persistedUser.id,
        role: 'user',
        type: 'voice',
        content: [
          {
            content: audioTranscriptionResult,
            embedding: mockEmbeddings,
          },
        ],
      },
      {
        externalId: `${messageExternalId - 1}`,
        userId: persistedUser.id,
        role: 'assistant',
        type: 'text',
        content: [
          {
            content: aiTextResponse,
            embedding: mockEmbeddings,
          },
        ],
      },
    ])
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

    const result = await agent(deps, message)
    expect(result).toBeUndefined()
    expect(deps.db.persistUser).toHaveBeenCalledWith({
      externalId: message.userExternalId,
      name: message.userName,
    })
    expect(deps.chat.acknowledgeProcessingMessage).toHaveBeenCalled()
    expect(deps.ai.transcribeAudio).toHaveBeenCalledWith({ audio: message.mediaData })
    expect(deps.ai.respond).toHaveBeenCalledWith({
      messages: [
        {
          role: 'system',
          content: Prompt.audioTranscription(audioTranscriptionResult),
        },
      ],
    })
    expect(deps.chat.sendTextMessage).toHaveBeenCalledWith({ text: aiTextResponse })
    expect(deps.storage.store).not.toHaveBeenCalled()
    expect(deps.ai.improveUserProfile).not.toHaveBeenCalled()
    expect(deps.db.updateUserProfile).not.toHaveBeenCalled()
    expect(deps.ai.generateEmbeddings.mock.calls[0]?.[0]).toEqual({
      text: [Prompt.audioTranscription(audioTranscriptionResult), aiTextResponse],
    })
    const persistedUser = (await deps.db.persistUser.mock.results[0]?.value) as UserComponent
    expect(deps.db.storeMessage.mock.calls[0]?.[0]).toEqual([
      {
        userId: persistedUser.id,
        role: 'system',
        type: 'audio',
        content: [
          {
            content: Prompt.audioTranscription(audioTranscriptionResult),
            embedding: mockEmbeddings,
          },
        ],
      },
      {
        externalId: `${messageExternalId - 1}`,
        userId: persistedUser.id,
        role: 'assistant',
        type: 'text',
        content: [
          {
            content: aiTextResponse,
            embedding: mockEmbeddings,
          },
        ],
      },
    ])
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

    const result = await agent(deps, message)
    expect(result).toBeUndefined()
    expect(deps.db.persistUser).toHaveBeenCalledWith({
      externalId: message.userExternalId,
      name: message.userName,
    })
    const persistedUser = (await deps.db.persistUser.mock.results[0]?.value) as UserComponent
    expect(persistedUser).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        externalId: message.userExternalId,
        name: message.userName,
        joinedAt: expect.any(Date),
        profile: '',
      })
    )
    expect(deps.chat.acknowledgeProcessingMessage).toHaveBeenCalled()
    expect(deps.ai.analyzeImage.mock.calls[0]?.[0]).toEqual({
      imageUrl: `data:image/jpeg;base64,${Buffer.from(message.mediaData!).toString('base64')}`,
      caption: message.text,
    })
    expect(deps.ai.respond.mock.calls[0]?.[0]).toEqual({
      messages: [
        { role: 'system', content: Prompt.imageDescription(imageAnalysisResult) },
        { role: 'user', content: message.text },
      ],
    })
    expect(deps.chat.sendTextMessage.mock.calls[0]?.[0]).toEqual({ text: aiTextResponse })
    expect(deps.storage.store.mock.calls[0]?.[0]).toEqual({
      key: expect.stringMatching(new RegExp(`^${persistedUser.id}/.*`)),
      data: message.mediaData,
      mimeType: message.mimeType,
    })
    expect(deps.ai.improveUserProfile.mock.calls[0]?.[0]).toEqual({
      profile: persistedUser.profile,
      message: message.text,
    })
    expect(deps.ai.generateEmbeddings.mock.calls[0]?.[0]).toEqual({
      text: [message.text],
    })
    expect(deps.ai.generateEmbeddings.mock.calls[1]?.[0]).toEqual({
      text: [Prompt.imageDescription(imageAnalysisResult), aiTextResponse],
    })
    expect(deps.db.storeMessage.mock.calls[0]?.[0]).toEqual([
      {
        userId: persistedUser.id,
        role: 'system',
        type: 'image',
        mediaStorageKey: expect.stringMatching(new RegExp(`^${persistedUser.id}/.*`)),
        content: [
          {
            content: Prompt.imageDescription(imageAnalysisResult),
            embedding: mockEmbeddings,
          },
        ],
      },
      {
        externalId: message.externalId,
        userId: persistedUser.id,
        role: 'user',
        type: 'image',
        mediaStorageKey: expect.stringMatching(new RegExp(`^${persistedUser.id}/.*`)),
        content: [
          {
            content: message.text,
            embedding: mockEmbeddings,
          },
        ],
      },
      {
        externalId: `${messageExternalId - 1}`,
        userId: persistedUser.id,
        role: 'assistant',
        type: 'text',
        mediaStorageKey: expect.stringMatching(new RegExp(`^${persistedUser.id}/.*`)),
        content: [
          {
            content: aiTextResponse,
            embedding: mockEmbeddings,
          },
        ],
      },
    ])
    expect(deps.db.updateUserProfile.mock.calls[0]?.[0]).toEqual({
      userId: persistedUser.id,
      profile: updatedProfile,
      messageId: (await deps.db.storeMessage.mock.results[0].value)?.[0],
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

    const result = await agent(deps, message)
    expect(result).toBeUndefined()
    expect(deps.ai.improveUserProfile).not.toHaveBeenCalled()
    expect(deps.db.updateUserProfile).not.toHaveBeenCalled()
    expect(deps.chat.acknowledgeProcessingMessage).toHaveBeenCalled()

    expect(deps.db.persistUser.mock.calls[0]?.[0]).toEqual({
      externalId: message.userExternalId,
      name: message.userName,
    })
    const persistedUser = (await deps.db.persistUser.mock.results[0]?.value) as UserComponent
    expect(persistedUser).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        externalId: message.userExternalId,
        name: message.userName,
        joinedAt: expect.any(Date),
        profile: '',
      })
    )

    expect(deps.ai.analyzeImage.mock.calls[0]?.[0]).toEqual({
      imageUrl: `data:image/jpeg;base64,${Buffer.from(message.mediaData!).toString('base64')}`,
    })

    expect(deps.ai.respond.mock.calls[0]?.[0]).toEqual({
      messages: [
        { role: 'system', content: Prompt.imageDescription(imageAnalysisResult) },
        { role: 'system', content: Prompt.imageWithoutCaption },
      ],
    })
    expect(deps.chat.sendTextMessage.mock.calls[0]?.[0]).toEqual({
      text: aiTextResponse,
    })
    expect(deps.storage.store.mock.calls[0]?.[0]).toEqual({
      key: expect.stringMatching(new RegExp(`^${persistedUser.id}/.*`)),
      data: message.mediaData,
      mimeType: message.mimeType,
    })
    expect(deps.ai.generateEmbeddings.mock.calls[0]?.[0]).toEqual({
      text: [
        Prompt.imageDescription(imageAnalysisResult),
        Prompt.imageWithoutCaption,
        aiTextResponse,
      ],
    })
    expect(deps.db.storeMessage.mock.calls[0]?.[0]).toEqual([
      {
        userId: persistedUser.id,
        role: 'system',
        type: 'image',
        mediaStorageKey: expect.stringMatching(new RegExp(`^${persistedUser.id}/.*`)),
        content: [
          {
            content: Prompt.imageDescription(imageAnalysisResult),
            embedding: mockEmbeddings,
          },
        ],
      },
      {
        userId: persistedUser.id,
        role: 'system',
        type: 'image',
        mediaStorageKey: expect.stringMatching(new RegExp(`^${persistedUser.id}/.*`)),
        content: [
          {
            content: Prompt.imageWithoutCaption,
            embedding: mockEmbeddings,
          },
        ],
      },
      {
        externalId: `${messageExternalId - 1}`,
        userId: persistedUser.id,
        role: 'assistant',
        type: 'text',
        mediaStorageKey: expect.stringMatching(new RegExp(`^${persistedUser.id}/.*`)),
        content: [
          {
            content: aiTextResponse,
            embedding: mockEmbeddings,
          },
        ],
      },
    ])
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

    const result = await agent(deps, message)
    expect(result).toBeUndefined()
    expect(deps.chat.acknowledgeProcessingMessage).toHaveBeenCalled()
    expect(deps.db.updateUserProfile).not.toHaveBeenCalled()

    expect(deps.db.persistUser.mock.calls[0]?.[0]).toEqual({
      externalId: message.userExternalId,
      name: message.userName,
    })
    const persistedUser = (await deps.db.persistUser.mock.results[0]?.value) as UserComponent
    expect(persistedUser).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        externalId: message.userExternalId,
        name: message.userName,
        joinedAt: expect.any(Date),
        profile: '',
      })
    )
    expect(deps.ai.transcribeDocument.mock.calls[0]?.[0]).toEqual({
      document: message.mediaData,
      mimeType: message.mimeType,
      filename: message.documentFilename,
    })

    expect(deps.ai.respond.mock.calls[0]?.[0]).toEqual({
      messages: [
        {
          role: 'system',
          content: Prompt.documentDescription(
            documentTranscriptionResult,
            message.documentFilename!
          ),
        },
      ],
    })
    expect(deps.chat.sendTextMessage.mock.calls[0]?.[0]).toEqual({ text: aiTextResponse })
    expect(deps.storage.store.mock.calls[0]?.[0]).toEqual({
      key: expect.stringMatching(new RegExp(`^${persistedUser.id}/.*`)),
      data: message.mediaData,
      mimeType: message.mimeType,
    })

    expect(deps.ai.generateEmbeddings.mock.calls[0]?.[0]).toEqual({
      text: [
        Prompt.documentDescription(documentTranscriptionResult, message.documentFilename!),
        aiTextResponse,
      ],
    })
    expect(deps.db.storeMessage.mock.calls[0]?.[0]).toEqual([
      {
        userId: persistedUser.id,
        role: 'system',
        type: 'document',
        mediaStorageKey: expect.stringMatching(new RegExp(`^${persistedUser.id}/.*`)),
        content: [
          {
            content: Prompt.documentDescription(
              documentTranscriptionResult,
              message.documentFilename!
            ),
            embedding: mockEmbeddings,
          },
        ],
      },
      {
        externalId: `${messageExternalId - 1}`,
        userId: persistedUser.id,
        role: 'assistant',
        type: 'text',
        mediaStorageKey: expect.stringMatching(new RegExp(`^${persistedUser.id}/.*`)),
        content: [
          {
            content: aiTextResponse,
            embedding: mockEmbeddings,
          },
        ],
      },
    ])
  })
})

describe('Extra context: user profile', () => {
  const user = {
    id: '1',
    externalId: 'user-external-id',
    name: 'Test User',
    profile: 'user profile',
  }

  beforeEach(async () => {
    await dbClient.execute(
      `INSERT INTO user (id, external_id, name) VALUES (?, ?, ?);`,
      Object.values(user)
    )
    await dbClient.execute(
      `INSERT INTO user_profile_version (id, user_id, profile) VALUES (?, ?, ?);`,
      [Bun.randomUUIDv7(), user.id, user.profile]
    )
  })

  test('Include existing user profile in LLM context when responding to text message', async () => {
    const message: IncomingMessage = {
      userExternalId: user.externalId,
      userName: user.name,
      externalId: 'user-msg-external-id',
      type: 'text',
      text: 'user text',
    }

    await agent(deps, message)

    expect(deps.ai.respond.mock.calls[0]?.[0]).toEqual({
      messages: [
        { role: 'system', content: Prompt.userProfile(user.profile) },
        { role: 'user', content: message.text },
      ],
    })
  })
})

describe('Extra context: recent messages', () => {
  const user = {
    id: '1',
    externalId: 'user-external-id',
    name: 'Test User',
    profile: 'user profile',
  }

  beforeEach(async () => {
    await dbClient.execute(
      `INSERT INTO user (id, external_id, name) VALUES (?, ?, ?);`,
      Object.values(user)
    )
    await dbClient.execute(
      `INSERT INTO user_profile_version (id, user_id, profile) VALUES (?, ?, ?);`,
      [Bun.randomUUIDv7(), user.id, user.profile]
    )
  })

  test('Include recent messages in LLM context when responding to a series of text messages', async () => {
    import.meta.env.MAX_SIMILAR_MESSAGES = '0'
    const messages: Array<IncomingMessage> = Array.from({ length: 10 }, (_, i) => ({
      userExternalId: user.externalId,
      userName: user.name,
      externalId: `user-msg-external-id-${i}`,
      type: 'text',
      text: `user text ${i}`,
    }))
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]!
      await agent(deps, message)
      const expectedMessages = [
        { role: 'system', content: Prompt.userProfile(i === 0 ? user.profile : updatedProfile) },
        ...(i > 0 ? [{ role: 'system', content: Prompt.recentMessages }] : []),
        ...messages.slice(0, i).flatMap((message) => [
          { role: 'user', content: message.text },
          { role: 'assistant', content: aiTextResponse },
        ]),
        { role: 'user', content: message.text },
      ]
      expect(deps.ai.respond.mock.calls[i]?.[0]).toEqual({
        messages: expectedMessages,
      })
    }
  })

  test('Include recent messages in LLM context when responding to a series of mixed message types', async () => {
    import.meta.env.MAX_SIMILAR_MESSAGES = '0'

    const messages: Array<IncomingMessage> = [
      {
        userExternalId: user.externalId,
        userName: user.name,
        externalId: 'text-msg-1',
        type: 'text',
        text: 'Hello there',
      },
      {
        userExternalId: user.externalId,
        userName: user.name,
        externalId: 'voice-msg-1',
        type: 'voice',
        mediaData: new ArrayBuffer(1024),
        mimeType: 'audio/ogg',
      },
      {
        userExternalId: user.externalId,
        userName: user.name,
        externalId: 'image-msg-1',
        type: 'image',
        mediaData: new ArrayBuffer(1024),
        mimeType: 'image/jpeg',
        text: 'Look at this photo',
      },
    ]

    const expectedContexts = [
      // Text message
      [
        { role: 'system', content: Prompt.userProfile(user.profile) },
        { role: 'user', content: 'Hello there' },
      ],
      // Voice message
      [
        { role: 'system', content: Prompt.userProfile(updatedProfile) },
        { role: 'system', content: Prompt.recentMessages },
        { role: 'user', content: 'Hello there' },
        { role: 'assistant', content: aiTextResponse },
        { role: 'user', content: audioTranscriptionResult },
      ],
      // Image message with caption
      [
        { role: 'system', content: Prompt.userProfile(updatedProfile) },
        { role: 'system', content: Prompt.recentMessages },
        { role: 'user', content: 'Hello there' },
        { role: 'assistant', content: aiTextResponse },
        { role: 'user', content: audioTranscriptionResult },
        { role: 'assistant', content: aiTextResponse },
        { role: 'system', content: Prompt.imageDescription(imageAnalysisResult) },
        { role: 'user', content: 'Look at this photo' },
      ],
    ]

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]!
      await agent(deps, message)
      expect(deps.ai.respond.mock.calls[i]?.[0]?.messages).toEqual(expectedContexts[i])
    }
  })

  test('Limit recent messages to maximum configured amount', async () => {
    const messageCount = 20
    const maxRecentMessages = 10
    import.meta.env.MAX_RECENT_MESSAGES = maxRecentMessages.toString()
    import.meta.env.MAX_SIMILAR_MESSAGES = '0'

    const messages: Array<IncomingMessage> = Array.from({ length: messageCount }, (_, i) => ({
      userExternalId: user.externalId,
      userName: user.name,
      externalId: `msg-${i}`,
      type: 'text',
      text: `Message ${i}`,
    }))

    for (const message of messages) {
      await agent(deps, message)
    }

    const finalMessage: IncomingMessage = {
      userExternalId: user.externalId,
      userName: user.name,
      externalId: 'final-msg',
      type: 'text',
      text: 'Final message',
    }
    await agent(deps, finalMessage)
    const contextMessages = deps.ai.respond.mock.calls[messageCount]?.[0]?.messages || []

    // Should have:
    // 1. User profile system message
    // 2. Recent messages system message
    // 3. Only the last 10 message
    // 4. Current user message
    expect(contextMessages.length).toBe(13)

    expect(contextMessages[0]).toEqual({
      role: 'system',
      content: Prompt.userProfile(updatedProfile),
    })

    for (let i = 0; i < maxRecentMessages; i += 2) {
      expect(contextMessages[i + 2]).toEqual({
        role: 'user',
        content: `Message ${(messageCount * 2 - maxRecentMessages) / 2 + i / 2}`,
      })
      expect(contextMessages[i + 3]).toEqual({
        role: 'assistant',
        content: aiTextResponse,
      })
    }

    expect(contextMessages.at(-1)).toEqual({
      role: 'user',
      content: finalMessage.text,
    })
  })
})

describe('Extra context: similar messages', () => {
  const user = {
    id: '1',
    externalId: 'user-external-id',
    name: 'Test User',
    profile: 'user profile',
  }

  beforeEach(async () => {
    await dbClient.execute(
      `INSERT INTO user (id, external_id, name) VALUES (?, ?, ?);`,
      Object.values(user)
    )
    await dbClient.execute(
      `INSERT INTO user_profile_version (id, user_id, profile) VALUES (?, ?, ?);`,
      [Bun.randomUUIDv7(), user.id, user.profile]
    )
  })

  test('Include similar messages in LLM context when responding to a message about greetings', async () => {
    await dbClient.executeMultiple(await Bun.file('./test/memory.sql').text())
    import.meta.env.MAX_RECENT_MESSAGES = '0'
    const message: IncomingMessage = {
      userExternalId: user.externalId,
      userName: user.name,
      externalId: 'new-greeting-msg',
      type: 'text',
      text: 'Hi there, how are you doing?',
    }
    deps.ai.generateEmbeddings.mockReturnValue([
      [
        -0.08380126953125, -0.033355712890625, 0.09051513671875, -0.042236328125,
        -0.0235443115234375, -0.0095977783203125, 0.1351318359375, 0.049041748046875,
        0.0008392333984375, 0.036956787109375, 0.0211944580078125, -0.1046142578125,
        0.03619384765625, 0.025146484375, 0.032073974609375, -0.01824951171875,
        -0.003314971923828125, -0.1251220703125, -0.1571044921875, 0.00785064697265625,
        -0.08184814453125, 0.01476287841796875, -0.044586181640625, -0.023895263671875,
        0.050567626953125, 0.007793426513671875, 0.003971099853515625, -0.01934814453125,
        -0.03826904296875, -0.08544921875, -0.03631591796875, -0.0157928466796875, 0.06134033203125,
        -0.0166778564453125, 0.04803466796875, -0.0214691162109375, -0.013031005859375,
        0.013214111328125, -0.013580322265625, 0.0029697418212890625, 0.03436279296875,
        -0.03900146484375, -0.028656005859375, -0.059539794921875, 0.0250701904296875,
        -0.039154052734375, 0.0181121826171875, -0.0052490234375, -0.01026153564453125,
        -0.00466156005859375, -0.05145263671875, 0.039459228515625, 0.0157928466796875,
        0.024017333984375, 0.0281219482421875, 0.07000732421875, 0.11114501953125,
        -0.0203399658203125, 0.02581787109375, 0.0132598876953125, 0.024627685546875,
        0.0386962890625, -0.12841796875, 0.046112060546875, -0.054473876953125, -0.027679443359375,
        -0.043792724609375, -0.0732421875, -0.0038127899169921875, 0.06402587890625,
        -0.0151214599609375, -0.04534912109375, 0.00429534912109375, 0.0285491943359375,
        0.03729248046875, 0.020263671875, 0.0819091796875, -0.0307769775390625, 0.042938232421875,
        -0.03369140625, 0.03839111328125, -0.03778076171875, -0.014495849609375, 0.033782958984375,
        -0.00775146484375, -0.0186767578125, -0.0217132568359375, 0.07891845703125,
        -0.0207366943359375, -0.034759521484375, -0.0283050537109375, 0.06915283203125,
        0.01056671142578125, 0.0577392578125, -0.019989013671875, -0.0389404296875,
        0.00942230224609375, 0.0599365234375, -0.11175537109375, 0.11151123046875, -0.042236328125,
        0.0089263916015625, 0.156982421875, -0.0643310546875, -0.0249786376953125,
        0.0181121826171875, 0.006488800048828125, -0.018707275390625, 0.02813720703125,
        -0.04986572265625, 0.027008056640625, -0.0255584716796875, 0.034423828125,
        -0.004459381103515625, 0.045745849609375, 0.02410888671875, 0.025909423828125,
        -0.006916046142578125, 0.0606689453125, -0.0587158203125, 0.009674072265625,
        0.02838134765625, -0.008331298828125, -0.024322509765625, 0.116943359375, -0.0789794921875,
        0.1234130859375, 0.05999755859375, -0.00970458984375, 0.0277099609375, 0.03643798828125,
        0.0021686553955078125, -0.07879638671875, 0.006946563720703125, -0.056488037109375,
        0.0240020751953125, 0.0227203369140625, -0.026336669921875, 0.03216552734375,
        0.05303955078125, -0.05279541015625, -0.08892822265625, -0.07183837890625, -0.1363525390625,
        -0.00855255126953125, 0.054290771484375, -0.031494140625, 0.026275634765625,
        0.0218353271484375, 0.0075836181640625, -0.042633056640625, 0.04522705078125,
        -0.0279693603515625, -0.07598876953125, 0.01221466064453125, 0.0205078125, 0.06646728515625,
        0.02099609375, -0.0174407958984375, 0.016815185546875, 0.002933502197265625,
        -0.033905029296875, -0.021728515625, -0.004505157470703125, 0.0256500244140625,
        -0.068359375, -0.00827789306640625, 0.041229248046875, 0.0255126953125, 0.0180816650390625,
        0.06170654296875, 0.035430908203125, 0.003444671630859375, 0.0252532958984375,
        0.10345458984375, 0.00890350341796875, 0.0261993408203125, 0.019073486328125,
        -0.033599853515625, -0.028594970703125, 0.00426483154296875, 0.0253753662109375,
        0.0025348663330078125, -0.037200927734375, -0.007762908935546875, -0.054229736328125,
        -0.00994873046875, 0.0182342529296875, 0.02490234375, 0.014678955078125,
        -0.002140045166015625, -0.09637451171875, -0.0270843505859375, 0.0516357421875,
        -0.0088958740234375, 0.01336669921875, 0.01470184326171875, -0.011077880859375,
        -0.0144500732421875, 0.051544189453125, 0.043060302734375, 0.0054931640625,
        0.045989990234375, 0.07666015625, 0.0721435546875, 0.02569580078125, -0.00978851318359375,
        -0.00928497314453125, 0.054443359375, 0.0648193359375, -0.0085906982421875,
        -0.0648193359375, 0.11297607421875, 0.0006136894226074219, -0.0150909423828125,
        -0.0687255859375, -0.0335693359375, 0.06304931640625, -0.0599365234375, 0.026763916015625,
        0.039764404296875, -0.0190277099609375, -0.0234375, -0.1778564453125, 0.01422882080078125,
        0.015960693359375, -0.001496315002441406, 0.0102386474609375, -0.04168701171875,
        0.07159423828125, 0.04473876953125, 0.09356689453125, 0.0177764892578125,
        -0.0007224082946777344, -0.0458984375, -0.002361297607421875, 0.0096893310546875,
        0.03961181640625, 0.01383209228515625, 0.0288238525390625, -0.090576171875,
        0.003063201904296875, -0.0293731689453125, 0.040557861328125, -0.0020198822021484375,
        0.00928497314453125, -0.0246124267578125, -0.011444091796875, -0.043243408203125,
        0.1363525390625, 0.146728515625, 0.0736083984375, -0.0116119384765625, 0.0243377685546875,
        -0.01314544677734375, 0.01102447509765625, -0.248046875, 0.07843017578125,
        0.0306854248046875, -0.058746337890625, -0.0631103515625, -0.11346435546875,
        -0.01702880859375, -0.0081939697265625, -0.0213775634765625, -0.025115966796875,
        -0.056671142578125, 0.026611328125, -0.04345703125, -0.0226287841796875, -0.07037353515625,
        -0.043212890625, 0.0254364013671875, 0.007450103759765625, -0.07574462890625,
        -0.0168304443359375, 0.012969970703125, -0.025543212890625, -0.055084228515625,
        -0.048980712890625, -0.053985595703125, -0.03338623046875, 0.0733642578125,
        -0.0305023193359375, 0.04888916015625, 0.039398193359375, 0.048187255859375,
        0.0487060546875, 0.058258056640625, 0.0009007453918457031, 0.0021495819091796875,
        0.055755615234375, -0.0171966552734375, 0.0157623291015625, -0.0106964111328125,
        -0.0577392578125, 0.00443267822265625, 0.0217742919921875, 0.038970947265625,
        0.046844482421875, 0.0270233154296875, -0.0048828125, -0.0207672119140625, 0.04290771484375,
        -0.0234527587890625, 0.0282135009765625, -0.0014514923095703125, 0.027008056640625,
        -0.021728515625, -0.036529541015625, -0.022308349609375, 0.04669189453125,
        -0.01158905029296875, -0.03350830078125, 0.0142669677734375, -0.0310516357421875,
        -0.141845703125, -0.002391815185546875, -0.0112457275390625, -0.1529541015625,
        0.0294342041015625, 0.0228424072265625, -0.026885986328125, -0.03704833984375,
        -0.00756072998046875, 0.05206298828125, 0.135498046875, -0.09991455078125,
        0.030242919921875, 0.0472412109375, 0.0556640625, 0.0054168701171875, -0.038665771484375,
        -0.003360748291015625, -0.046875, 0.030517578125, -0.0916748046875, 0.045562744140625,
        0.00353240966796875, 0.0259857177734375, -0.037017822265625, 0.08795166015625,
        -0.001956939697265625, 0.12274169921875, 0.041412353515625, 0.0119781494140625,
        0.05987548828125, 0.01195526123046875, -0.0411376953125, 0.0118255615234375,
        0.005901336669921875, 0.057525634765625, -0.039306640625, 0.0202178955078125,
        -0.039703369140625, -0.0849609375, 0.009613037109375, 0.0231170654296875, -0.04510498046875,
        -0.0164947509765625, -0.03826904296875, -0.0021076202392578125, 0.004146575927734375,
        0.1075439453125, -0.037017822265625, -0.039794921875, -0.01076507568359375,
        -0.00994873046875, -0.0117645263671875, -0.0226898193359375, -0.00618743896484375,
        0.007625579833984375, 0.006191253662109375, 0.022125244140625, -0.01256561279296875,
        -0.028228759765625, -0.0228424072265625, -0.006008148193359375, -0.0604248046875,
        -0.07769775390625, 0.0081024169921875, 0.07537841796875, 0.06536865234375, 0.0360107421875,
      ],
    ])
    await agent(deps, message)

    const aiRespondCall = (deps.ai.respond as any).mock.calls[0]?.[0]
    const messages = aiRespondCall?.messages || []

    // Should have: user profile, similar messages, and user message
    expect(messages.length).toBeGreaterThanOrEqual(3)

    expect(messages[0]).toEqual({ role: 'system', content: Prompt.userProfile(user.profile) })

    // Second message should be similar messages
    expect(messages[1]).toEqual(
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('# User Memory'),
      })
    )

    // Verify that similar messages block contains expected content
    const similarMessageContent = messages[1]?.content
    expect(similarMessageContent).toContain('Hello, how are you?')
    expect(similarMessageContent).toContain("Hi, I'm fine.")

    // Last message should be the current user message
    expect(messages[messages.length - 1]).toEqual({ role: 'user', content: message.text })
  })

  test('Include similar messages in LLM context when responding to a message about weather', async () => {
    await dbClient.executeMultiple(await Bun.file('./test/memory.sql').text())
    import.meta.env.MAX_RECENT_MESSAGES = '0'
    const message: IncomingMessage = {
      userExternalId: user.externalId,
      userName: user.name,
      externalId: 'new-weather-msg',
      type: 'text',
      text: 'How is the weather today?',
    }
    deps.ai.generateEmbeddings.mockReturnValue([
      [
        -0.039093017578125, 0.01145172119140625, 0.0023593902587890625, 0.01629638671875,
        0.1082763671875, 0.048065185546875, 0.08416748046875, -0.03192138671875, 0.04071044921875,
        0.018280029296875, -0.045501708984375, -0.05523681640625, 0.0137786865234375,
        0.0780029296875, 0.0129547119140625, 0.01629638671875, 0.0364990234375, -0.031280517578125,
        -0.020782470703125, 0.032562255859375, -0.046722412109375, -0.0197906494140625,
        -0.034759521484375, -0.055572509765625, -0.0025272369384765625, 0.03741455078125,
        0.0157928466796875, 0.046722412109375, 0.0028820037841796875, -0.07159423828125,
        -0.05316162109375, -0.033538818359375, 0.00649261474609375, -0.0058746337890625,
        0.01617431640625, -0.039764404296875, -0.0118560791015625, -0.011932373046875,
        -0.07147216796875, -0.0292816162109375, 0.0333251953125, -0.0355224609375,
        -0.09405517578125, -0.0148773193359375, -0.06243896484375, 0.01552581787109375,
        0.0122833251953125, 0.0243072509765625, 0.06500244140625, -0.062744140625,
        0.016448974609375, -0.06072998046875, -0.0150146484375, -0.0030231475830078125,
        0.030303955078125, 0.054290771484375, 0.039520263671875, 0.0185699462890625,
        -0.01287841796875, -0.007480621337890625, 0.001324653625488281, 0.04736328125, -0.1328125,
        0.0299224853515625, -0.007190704345703125, -0.060882568359375, -0.01152801513671875,
        0.0178985595703125, 0.03961181640625, -0.0121917724609375, 0.001225471496582031,
        0.0283966064453125, 0.03265380859375, 0.06640625, 0.0247955322265625, -0.01236724853515625,
        -0.041717529296875, -0.05584716796875, -0.0560302734375, -0.08154296875,
        -0.00693511962890625, -0.038299560546875, -0.0205078125, -0.00859832763671875,
        0.0157012939453125, 0.09039306640625, 0.001163482666015625, -0.008453369140625,
        0.032806396484375, -0.007843017578125, -0.0853271484375, -0.0026187896728515625,
        -0.10015869140625, -0.01103973388671875, -0.01076507568359375, 0.0241241455078125,
        0.0116119384765625, 0.006923675537109375, 0.0008802413940429688, 0.14501953125,
        -0.0745849609375, 0.051910400390625, 0.09100341796875, -0.041900634765625,
        -0.018585205078125, -0.030975341796875, -0.001697540283203125, -0.0548095703125,
        -0.03424072265625, -0.031494140625, 0.002635955810546875, 0.00533294677734375,
        0.052703857421875, 0.06732177734375, 0.0104827880859375, -0.01340484619140625,
        0.045440673828125, 0.083984375, -0.053466796875, -0.020416259765625, 0.005329132080078125,
        -0.006832122802734375, 0.030364990234375, 0.05828857421875, 0.032379150390625,
        -0.0018873214721679688, 0.0709228515625, 0.109619140625, 0.026092529296875, 0.0753173828125,
        0.03533935546875, -0.080322265625, 0.051239013671875, -0.073974609375, 0.046875,
        0.0018768310546875, -0.0290374755859375, -0.035064697265625, -0.0211029052734375,
        -0.02264404296875, -0.020294189453125, -0.10382080078125, -0.00604248046875,
        -0.1448974609375, 0.0810546875, 0.047332763671875, -0.0694580078125, 0.01136016845703125,
        -0.009521484375, -0.02410888671875, -0.0188140869140625, 0.0225372314453125,
        0.0269622802734375, -0.0013713836669921875, -0.0051422119140625, 0.0114593505859375,
        -0.0105438232421875, 0.1236572265625, 0.0426025390625, 0.033843994140625, 0.06939697265625,
        0.007686614990234375, -0.0184478759765625, -0.07080078125, -0.007419586181640625,
        -0.027435302734375, 0.018096923828125, 0.03350830078125, 0.00047016143798828125,
        0.0021648406982421875, 0.03643798828125, 0.06640625, -0.0345458984375, 0.0548095703125,
        0.1446533203125, 0.023651123046875, -0.00844573974609375, 0.0799560546875, -0.0306396484375,
        0.032623291015625, 0.058837890625, -0.032501220703125, -0.0232391357421875,
        -0.0036563873291015625, 0.041961669921875, -0.0034656524658203125, 0.006366729736328125,
        -0.0084991455078125, -0.007038116455078125, -0.0323486328125, -0.0177154541015625,
        0.007659912109375, -0.028533935546875, -0.00942230224609375, -0.06988525390625,
        -0.0177001953125, -0.0440673828125, -0.0171966552734375, 0.0177764892578125,
        0.008209228515625, 0.039642333984375, -0.04254150390625, 0.00800323486328125,
        0.0016994476318359375, 0.04974365234375, -0.0136871337890625, 0.067138671875,
        -0.02655029296875, -0.000591278076171875, 0.0128936767578125, 0.050628662109375,
        -0.015045166015625, 0.07586669921875, -0.0015869140625, -0.004150390625,
        -0.01497650146484375, -0.00015664100646972656, 0.04010009765625, -0.004619598388671875,
        -0.006923675537109375, 0.0498046875, -0.0572509765625, 0.003803253173828125,
        -0.2100830078125, 0.01332855224609375, 0.050689697265625, -0.07659912109375,
        0.06427001953125, -0.01111602783203125, 0.058349609375, -0.028167724609375, 0.1341552734375,
        -0.034332275390625, 0.06744384765625, -0.1087646484375, 0.026702880859375, -0.09716796875,
        0.00745391845703125, -0.0033206939697265625, 0.02301025390625, 0.08013916015625,
        0.04937744140625, -0.05572509765625, -0.034149169921875, 0.0219268798828125,
        -0.049072265625, -0.046630859375, 0.07855224609375, -0.0582275390625, 0.18798828125,
        0.0736083984375, -0.023101806640625, -0.07232666015625, -0.005565643310546875,
        -0.0753173828125, -0.01617431640625, -0.1370849609375, 0.037445068359375, 0.048797607421875,
        0.0316162109375, -0.0026760101318359375, -0.11871337890625, 0.0521240234375,
        0.07000732421875, 0.06781005859375, -0.023773193359375, -0.0408935546875, -0.01702880859375,
        -0.032989501953125, 0.0171051025390625, 0.038604736328125, -0.046112060546875,
        -0.0740966796875, -0.00411224365234375, -0.05963134765625, 0.0109710693359375,
        -0.007083892822265625, 0.0394287109375, -0.08612060546875, -0.034759521484375,
        0.03179931640625, -0.023895263671875, 0.032684326171875, -0.021148681640625,
        0.0083465576171875, 0.0182037353515625, 0.0209503173828125, 0.04266357421875,
        0.049407958984375, -0.003612518310546875, -0.058837890625, 0.01104736328125,
        0.03070068359375, -0.015716552734375, 0.0167083740234375, -0.031829833984375,
        -0.0086669921875, 0.041534423828125, 0.03204345703125, 0.03173828125, 0.00560760498046875,
        0.0035953521728515625, -0.030731201171875, 0.09307861328125, -0.058837890625,
        0.03985595703125, 0.06817626953125, 0.048187255859375, -0.051910400390625,
        0.00872039794921875, 0.01103973388671875, -0.0017375946044921875, -0.08270263671875,
        0.01287078857421875, -0.01010894775390625, -0.00524139404296875, -0.0830078125,
        0.049591064453125, -0.0211029052734375, -0.27294921875, -0.0352783203125, -0.08392333984375,
        -0.05352783203125, -0.020782470703125, 0.035247802734375, 0.07159423828125,
        0.12213134765625, -0.0816650390625, 0.0006933212280273438, -0.0178070068359375,
        0.0178680419921875, 0.034515380859375, 0.042724609375, -0.0120086669921875,
        -0.031524658203125, -0.0289459228515625, 0.006664276123046875, -0.0252838134765625,
        -0.0283966064453125, 0.05780029296875, 0.01197052001953125, 0.12347412109375,
        -0.044036865234375, 0.08770751953125, 0.08258056640625, -0.050201416015625,
        -0.023590087890625, 0.034942626953125, -0.00148773193359375, 0.0716552734375,
        -0.051727294921875, 0.05535888671875, -0.0275421142578125, 0.021881103515625,
        0.035308837890625, -0.0029010772705078125, -0.0135040283203125, 0.0445556640625,
        -0.00988006591796875, -0.048248291015625, 0.060943603515625, 0.004001617431640625,
        0.03387451171875, 0.06005859375, -0.0440673828125, 0.028564453125, -0.03594970703125,
        -0.0138702392578125, -0.00458526611328125, 0.0021228790283203125, 0.0248260498046875,
        -0.04644775390625, 0.041229248046875, -0.0293121337890625, -0.01221466064453125,
        -0.06475830078125, -0.038818359375, -0.0167236328125, -0.00576019287109375,
        0.008941650390625, -0.07354736328125, -0.0037288665771484375, -0.055938720703125,
        0.035919189453125,
      ],
    ])

    await agent(deps, message)

    // Get the AI response call to inspect the messages
    const aiRespondCall = (deps.ai.respond as any).mock.calls[0]?.[0]
    const messages = aiRespondCall?.messages || []

    // Should have: user profile, similar messages, and user message
    expect(messages.length).toBeGreaterThanOrEqual(3)

    // First message should be user profile
    expect(messages[0]).toEqual({ role: 'system', content: Prompt.userProfile(user.profile) })

    // Second message should be similar messages
    expect(messages[1]).toEqual(
      expect.objectContaining({
        role: 'system',
        content: expect.stringContaining('# User Memory'),
      })
    )

    // Verify that similar messages block contains expected weather-related content
    const similarMessageContent = messages[1]?.content
    expect(similarMessageContent).toContain("What's the weather like?")
    expect(similarMessageContent).toContain("It's sunny today.")

    // Last message should be the current user message
    expect(messages[messages.length - 1]).toEqual({ role: 'user', content: message.text })
  })

  test('Should not include the same message in both recent and similar contexts', async () => {
    await dbClient.executeMultiple(`
      INSERT INTO message (id, external_id, user_id, role, type, timestamp) VALUES ('mem-1', 'ext-mem-1', '1', 'user', 'text', '2025-01-01T10:00:00.000Z');
      INSERT INTO embedding (message_id, sequence, content, embedding) VALUES ('mem-1', 1, 'Tell me a joke.', vector32('[-0.0703125,0.035980224609375,0.040985107421875,0.00626373291015625,-0.0279693603515625,-0.0032024383544921875,0.1136474609375,0.043548583984375,0.01971435546875,0.00994110107421875,0.00971221923828125,-0.06597900390625,0.0284881591796875,0.0225067138671875,0.028045654296875,0.005096435546875,0.0538330078125,-0.051513671875,-0.1468505859375,0.041259765625,0.054290771484375,0.01438140869140625,-0.0552978515625,0.0020046234130859375,-0.010406494140625,-0.01558685302734375,-0.03729248046875,-0.01302337646484375,-0.05596923828125,-0.00780487060546875,-0.0202484130859375,-0.00399017333984375,-0.04901123046875,-0.0175933837890625,0.061248779296875,0.003269195556640625,0.0128173828125,-0.036895751953125,0.006580352783203125,-0.009429931640625,0.049774169921875,0.0204315185546875,0.00966644287109375,-0.061187744140625,0.034393310546875,-0.03778076171875,-0.0192108154296875,0.06036376953125,0.0517578125,-0.00016367435455322266,-0.0193023681640625,-0.019866943359375,-0.004756927490234375,-0.05267333984375,-0.01399993896484375,-0.00817108154296875,0.030792236328125,0.0088958740234375,0.041259765625,0.03741455078125,-0.0007796287536621094,-0.04180908203125,-0.064453125,0.12017822265625,-0.03924560546875,-0.0086517333984375,-0.05499267578125,0.004650115966796875,-0.00833892822265625,0.12646484375,0.007434844970703125,-0.037750244140625,0.0285186767578125,0.111328125,-0.048248291015625,0.0322265625,-0.0003769397735595703,0.0206451416015625,0.00644683837890625,0.00592041015625,-0.05126953125,-0.04510498046875,-0.031036376953125,-0.0157318115234375,0.00011330842971801758,-0.0543212890625,0.002124786376953125,0.1156005859375,-0.01378631591796875,-0.0078125,0.0185699462890625,-0.0032253265380859375,0.022552490234375,0.0104522705078125,-0.052093505859375,-0.0147247314453125,0.00360870361328125,-0.07275390625,-0.0269775390625,0.267333984375,-0.010894775390625,-0.01104736328125,0.049835205078125,-0.06591796875,-0.01541900634765625,0.0154876708984375,-0.03045654296875,-0.04522705078125,-0.00033545494079589844,0.014434814453125,0.007205963134765625,0.0028247833251953125,0.043182373046875,-0.054962158203125,0.0244903564453125,-0.03729248046875,0.04913330078125,0.01328277587890625,-0.062164306640625,-0.04144287109375,-0.00177001953125,0.06378173828125,-0.06951904296875,-0.0557861328125,0.0283203125,-0.07647705078125,0.0855712890625,0.0936279296875,-0.045989990234375,0.0163421630859375,0.0268402099609375,-0.0401611328125,0.00775909423828125,0.011474609375,-0.0034580230712890625,-0.010467529296875,-0.01177215576171875,0.04656982421875,0.054046630859375,0.0172882080078125,0.01180267333984375,-0.1439208984375,-0.06298828125,-0.0499267578125,-0.00826263427734375,0.02960205078125,-0.066650390625,-0.05621337890625,-0.0298004150390625,-0.016265869140625,0.01375579833984375,0.003772735595703125,0.0594482421875,-0.0552978515625,0.03375244140625,-0.035552978515625,0.02056884765625,-0.0172576904296875,-0.01476287841796875,0.01245880126953125,0.04150390625,-0.007904052734375,-0.00782012939453125,-0.07476806640625,0.02001953125,-0.056060791015625,-0.0305938720703125,0.00644683837890625,0.051116943359375,-0.06365966796875,0.04913330078125,0.0130157470703125,-0.03271484375,-0.04443359375,0.101318359375,-0.043975830078125,-0.0233001708984375,0.04486083984375,0.0382080078125,0.0026912689208984375,-0.042572021484375,-0.003520965576171875,-0.043548583984375,0.055145263671875,-0.0145416259765625,-0.07666015625,-0.038726806640625,0.017333984375,0.06488037109375,0.0184783935546875,-0.041107177734375,0.050384521484375,-0.0635986328125,0.046539306640625,-0.048736572265625,-0.0254058837890625,0.01467132568359375,-0.0016908645629882812,0.035980224609375,-0.043914794921875,-0.043975830078125,-0.036773681640625,0.015716552734375,0.06500244140625,0.01207733154296875,0.01080322265625,-0.02166748046875,-0.050872802734375,0.08087158203125,0.08642578125,-0.047698974609375,-0.0718994140625,0.09649658203125,-0.00006747245788574219,-0.00873565673828125,-0.08685302734375,0.00921630859375,-0.0265655517578125,-0.01265716552734375,-0.0269012451171875,0.01023101806640625,0.004669189453125,0.0306243896484375,-0.26708984375,0.044036865234375,0.060638427734375,-0.11370849609375,0.092529296875,0.0279693603515625,0.0537109375,-0.019500732421875,0.102294921875,0.07220458984375,0.0089263916015625,-0.056976318359375,0.0202484130859375,-0.01461029052734375,0.01529693603515625,-0.0020923614501953125,-0.033355712890625,0.075927734375,0.0435791015625,-0.0426025390625,0.033294677734375,0.022613525390625,-0.036834716796875,-0.062225341796875,0.0290374755859375,-0.0645751953125,0.1854248046875,0.1885986328125,0.042510986328125,-0.0200958251953125,0.0269775390625,0.0209808349609375,0.0020923614501953125,-0.090576171875,0.01629638671875,0.057861328125,-0.045989990234375,-0.039764404296875,-0.04974365234375,-0.01316070556640625,-0.044158935546875,0.07452392578125,-0.04571533203125,-0.055816650390625,0.022430419921875,-0.032928466796875,-0.01971435546875,-0.003017425537109375,-0.058837890625,0.0823974609375,0.0552978515625,-0.06292724609375,0.006992340087890625,0.0163421630859375,-0.00827789306640625,-0.0675048828125,-0.07000732421875,0.008331298828125,-0.00197601318359375,0.00820159912109375,-0.029632568359375,0.01715087890625,0.05059814453125,-0.0362548828125,-0.009429931640625,0.1015625,-0.0186614990234375,-0.044281005859375,0.05426025390625,0.0140228271484375,0.01354217529296875,0.087890625,0.04248046875,0.0016851425170898438,0.0279083251953125,0.0138092041015625,0.03363037109375,-0.020721435546875,-0.037384033203125,-0.037322998046875,0.035919189453125,-0.0022945404052734375,0.0231475830078125,0.007587432861328125,-0.01325225830078125,0.006439208984375,-0.042144775390625,-0.008392333984375,0.09417724609375,-0.00009918212890625,-0.031036376953125,0.057586669921875,0.03643798828125,-0.06268310546875,-0.059173583984375,-0.0465087890625,-0.2452392578125,0.0085601806640625,0.017547607421875,0.08111572265625,-0.02484130859375,0.0675048828125,-0.00197601318359375,-0.050018310546875,-0.034454345703125,-0.006683349609375,0.0295257568359375,0.01303863525390625,-0.01422882080078125,-0.013580322265625,0.033599853515625,-0.0030117034912109375,0.04376220703125,-0.004520416259765625,0.01267242431640625,0.0287322998046875,0.02520751953125,0.004642486572265625,0.1131591796875,0.016845703125,0.00360870361328125,0.0279998779296875,0.0714111328125,0.07379150390625,0.046722412109375,-0.01309967041015625,0.04986572265625,-0.0135345458984375,0.0007748603820800781,-0.030517578125,0.0283203125,0.006832122802734375,-0.0213470458984375,-0.0119171142578125,0.0217742919921875,0.018402099609375,-0.048858642578125,-0.040618896484375,0.0255584716796875,0.002666473388671875,0.05303955078125,-0.018798828125,-0.00908660888671875,-0.0260467529296875,0.00823974609375,-0.006252288818359375,-0.02191162109375,0.005573272705078125,-0.00167083740234375,0.013397216796875,0.002223968505859375,0.010894775390625,0.05194091796875,-0.0245361328125,-0.03277587890625,-0.03631591796875,-0.046600341796875,-0.0272979736328125,0.08380126953125,-0.043548583984375,-0.033050537109375]') );
      INSERT INTO message (id, external_id, user_id, role, type, timestamp) VALUES ('mem-2', 'ext-mem-2', '1', 'assistant', 'text', '2025-01-01T10:01:00.000Z');
      INSERT INTO embedding (message_id, sequence, content, embedding) VALUES ('mem-2', 1, 'Why did the chicken cross the road? To get to the other side.', vector32('[-0.004062652587890625,-0.054412841796875,0.0295257568359375,0.034942626953125,-0.006481170654296875,0.033050537109375,0.050323486328125,0.045166015625,0.0137481689453125,-0.01056671142578125,-0.029571533203125,-0.037445068359375,-0.01922607421875,0.0030651092529296875,0.011932373046875,-0.0225372314453125,-0.0838623046875,0.002094268798828125,-0.0799560546875,0.0250701904296875,-0.07635498046875,-0.0572509765625,0.004291534423828125,-0.0654296875,0.028106689453125,0.0623779296875,0.0177764892578125,0.042633056640625,-0.049774169921875,-0.1640625,0.01265716552734375,-0.070556640625,-0.02764892578125,-0.03759765625,-0.06109619140625,0.0179595947265625,0.0055999755859375,0.03826904296875,0.0282745361328125,0.026580810546875,0.08270263671875,0.028564453125,0.0226593017578125,0.0014734268188476562,-0.002227783203125,-0.018310546875,-0.036468505859375,0.0048065185546875,0.0966796875,-0.0880126953125,-0.047576904296875,-0.006931304931640625,-0.0828857421875,-0.033599853515625,0.0165863037109375,0.1226806640625,-0.007053375244140625,0.00977325439453125,0.00177001953125,0.00018537044525146484,0.0254974365234375,-0.015289306640625,-0.1412353515625,0.06439208984375,0.05596923828125,0.00013768672943115234,0.010284423828125,0.005741119384765625,0.0222625732421875,0.1016845703125,0.0048828125,-0.0249786376953125,-0.01763916015625,0.01338958740234375,0.029083251953125,0.01007843017578125,-0.035675048828125,0.0160980224609375,-0.0382080078125,-0.033782958984375,0.007076263427734375,0.0767822265625,-0.00965118408203125,0.029083251953125,-0.04302978515625,0.00824737548828125,-0.007595062255859375,-0.051483154296875,0.0462646484375,-0.031707763671875,0.054779052734375,-0.01306915283203125,-0.0022754669189453125,-0.022735595703125,-0.0074920654296875,-0.027435302734375,-0.0273284912109375,-0.0309600830078125,-0.021026611328125,0.1285400390625,-0.0286865234375,0.007602691650390625,0.029998779296875,0.01568603515625,-0.0006418228149414062,0.0083770751953125,0.0426025390625,-0.04412841796875,-0.0080413818359375,0.030517578125,0.048614501953125,-0.011260986328125,0.024688720703125,0.01352691650390625,0.034393310546875,0.03228759765625,-0.0215911865234375,-0.01462554931640625,-0.07073974609375,0.061737060546875,-0.01377105712890625,-0.0521240234375,0.0274810791015625,-0.0065460205078125,-0.032623291015625,-0.0501708984375,0.005985260009765625,0.08001708984375,0.0236053466796875,-0.045135498046875,0.04620361328125,-0.11785888671875,0.02972412109375,-0.04205322265625,0.050933837890625,0.0010662078857421875,-0.0062408447265625,-0.018280029296875,0.00844573974609375,-0.06439208984375,-0.03643798828125,-0.130859375,-0.01177978515625,-0.083740234375,-0.031646728515625,0.004451751708984375,0.05206298828125,0.0009555816650390625,-0.03155517578125,-0.010223388671875,0.04132080078125,-0.007843017578125,-0.056365966796875,-0.01517486572265625,-0.043670654296875,0.06927490234375,-0.0418701171875,0.08978271484375,0.01305389404296875,0.03143310546875,0.045654296875,-0.0350341796875,-0.053009033203125,0.0517578125,0.08843994140625,0.000007212162017822266,0.04705810546875,0.0188751220703125,0.05499267578125,-0.0015707015991210938,0.01129150390625,-0.0206146240234375,-0.049407958984375,-0.06707763671875,0.0225677490234375,0.04180908203125,-0.14599609375,0.06982421875,-0.07025146484375,-0.0284423828125,0.053741455078125,-0.01332855224609375,-0.06292724609375,0.01806640625,0.0218505859375,-0.019256591796875,-0.039886474609375,-0.0284881591796875,-0.0228118896484375,0.042633056640625,0.099853515625,0.0218353271484375,0.04486083984375,-0.07379150390625,-0.12384033203125,-0.0694580078125,0.041046142578125,0.096923828125,0.060455322265625,-0.039276123046875,-0.00989532470703125,-0.06744384765625,0.0120086669921875,-0.0047607421875,-0.04974365234375,-0.040313720703125,0.1246337890625,-0.05242919921875,-0.0005316734313964844,0.11865234375,0.026031494140625,0.0015411376953125,0.01041412353515625,-0.0238189697265625,0.0452880859375,-0.0277557373046875,-0.01233673095703125,0.036956787109375,0.07977294921875,0.03741455078125,0.0030059814453125,-0.03546142578125,0.05914306640625,-0.196044921875,-0.05255126953125,-0.03326416015625,-0.05859375,0.04437255859375,-0.033599853515625,0.0299072265625,0.02996826171875,0.0266876220703125,0.0260772705078125,0.143310546875,-0.07281494140625,-0.0292510986328125,0.007152557373046875,0.0058135986328125,0.053985595703125,-0.00957489013671875,0.041656494140625,0.0084991455078125,0.03955078125,-0.045684814453125,0.08349609375,-0.04400634765625,-0.0132904052734375,-0.00318145751953125,0.0185699462890625,0.1829833984375,0.06976318359375,0.062255859375,0.0223846435546875,0.01445770263671875,0.0184478759765625,0.01378631591796875,-0.03350830078125,0.01303863525390625,-0.00946044921875,0.04541015625,-0.062255859375,-0.044708251953125,-0.0347900390625,-0.029388427734375,0.062103271484375,-0.0202789306640625,-0.003124237060546875,-0.0281829833984375,0.0247650146484375,0.01111602783203125,-0.037384033203125,0.054962158203125,0.06890869140625,-0.0206451416015625,-0.00511932373046875,0.00989532470703125,0.07745361328125,0.04595947265625,0.01033782958984375,0.0184326171875,-0.01544952392578125,-0.014984130859375,0.08477783203125,-0.01546478271484375,0.01157379150390625,0.043609619140625,-0.007343292236328125,0.054168701171875,0.058197021484375,-0.045257568359375,0.0070648193359375,0.0238189697265625,0.062042236328125,0.01378631591796875,0.108154296875,-0.037689208984375,-0.0032196044921875,0.03863525390625,0.0187225341796875,0.059051513671875,-0.034332275390625,-0.02313232421875,-0.039703369140625,0.08758544921875,-0.0704345703125,0.00336456298828125,-0.00768280029296875,0.03936767578125,-0.055450439453125,-0.041900634765625,-0.048095703125,0.040863037109375,-0.03192138671875,0.046630859375,-0.05389404296875,-0.0726318359375,-0.052978515625,0.030609130859375,0.037109375,-0.244873046875,0.03619384765625,0.02581787109375,0.00827789306640625,-0.056671142578125,0.034576416015625,0.0184326171875,0.0545654296875,-0.07696533203125,-0.01190185546875,0.04522705078125,0.01995849609375,0.055938720703125,-0.00348663330078125,0.026397705078125,-0.002696990966796875,0.0079498291015625,-0.004608154296875,-0.036224365234375,-0.033660888671875,-0.017120361328125,0.042724609375,0.1451416015625,-0.007266998291015625,0.01039886474609375,-0.01666259765625,-0.07293701171875,-0.051177978515625,0.044769287109375,-0.0570068359375,0.0175628662109375,-0.0297393798828125,-0.0130462646484375,-0.09234619140625,0.10565185546875,-0.0032711029052734375,-0.037200927734375,0.035919189453125,0.0240631103515625,-0.01432037353515625,-0.05792236328125,0.034637451171875,0.05255126953125,-0.01107025146484375,0.038421630859375,0.0280303955078125,-0.006748199462890625,-0.059539794921875,0.00609588623046875,0.025787353515625,0.004787445068359375,-0.0079498291015625,-0.0633544921875,-0.041290283203125,0.032135009765625,-0.005123138427734375,-0.053436279296875,-0.01309967041015625,-0.031707763671875,0.01013946533203125,0.042327880859375,-0.1396484375,0.095947265625,-0.035125732421875,0.040771484375]') );
      INSERT INTO message (id, external_id, user_id, role, type, timestamp) VALUES ('mem-3', 'ext-mem-3', '1', 'user', 'text', '2025-01-01T10:02:00.000Z');
      INSERT INTO embedding (message_id, sequence, content, embedding) VALUES ('mem-3', 1, 'Hello, how are you?', vector32('[-0.042877197265625,-0.057342529296875,0.0543212890625,-0.03961181640625,-0.022552490234375,-0.01727294921875,0.1290283203125,0.033843994140625,0.0009136199951171875,0.0139923095703125,0.01174163818359375,-0.08013916015625,0.0556640625,0.043792724609375,0.056549072265625,-0.0037899017333984375,0.048431396484375,-0.12548828125,-0.1689453125,0.011962890625,-0.09564208984375,0.01361846923828125,-0.046417236328125,-0.0396728515625,-0.0022106170654296875,-0.0123138427734375,0.04119873046875,-0.015045166015625,-0.020751953125,-0.04266357421875,-0.0413818359375,-0.0028839111328125,0.04522705078125,0.0172882080078125,0.0421142578125,-0.007022857666015625,-0.005275726318359375,-0.0242462158203125,-0.035125732421875,-0.00390625,0.040557861328125,-0.047027587890625,-0.0240631103515625,-0.05487060546875,0.03472900390625,-0.03656005859375,0.019134521484375,0.047393798828125,-0.01357269287109375,-0.004360198974609375,-0.07843017578125,0.052642822265625,0.0115966796875,0.023651123046875,0.0147857666015625,0.0906982421875,0.10784912109375,-0.043304443359375,0.038177490234375,0.01038360595703125,0.028717041015625,0.036285400390625,-0.0828857421875,0.045257568359375,-0.02349853515625,-0.0007433891296386719,-0.0491943359375,-0.06182861328125,-0.0086669921875,0.03375244140625,0.0021533966064453125,-0.02899169921875,0.029632568359375,0.013641357421875,0.0428466796875,0.03955078125,0.08636474609375,-0.01959228515625,0.07781982421875,-0.03363037109375,-0.00164031982421875,-0.01367950439453125,-0.0290985107421875,0.039276123046875,0.01088714599609375,-0.008270263671875,-0.03997802734375,0.1002197265625,-0.035308837890625,-0.0288848876953125,-0.033355712890625,0.045623779296875,0.0106201171875,0.042724609375,0.00896453857421875,-0.0574951171875,0.00463104248046875,0.02044677734375,-0.0958251953125,0.2259521484375,-0.0294342041015625,0.02587890625,0.1141357421875,-0.06024169921875,-0.0272674560546875,0.005825042724609375,0.010589599609375,-0.017059326171875,0.0289154052734375,-0.0556640625,0.00884246826171875,-0.03631591796875,0.0452880859375,-0.0012254714965820312,0.0281982421875,0.007213592529296875,0.025726318359375,-0.0155181884765625,0.07373046875,-0.05694580078125,0.0164642333984375,0.019317626953125,-0.02374267578125,-0.005176544189453125,0.1063232421875,-0.07684326171875,0.12091064453125,0.06976318359375,-0.01178741455078125,0.0543212890625,0.03314208984375,0.002925872802734375,-0.080078125,0.006099700927734375,-0.039764404296875,0.0200347900390625,0.0103607177734375,-0.01806640625,0.01412200927734375,0.027801513671875,-0.0234527587890625,-0.0653076171875,-0.045257568359375,-0.11676025390625,0.0086822509765625,0.054656982421875,-0.0297393798828125,0.042877197265625,-0.003429412841796875,0.012603759765625,-0.0379638671875,0.0301971435546875,-0.0172576904296875,-0.07916259765625,0.0198516845703125,0.0265655517578125,0.03662109375,-0.004817962646484375,0.00506591796875,0.030059814453125,0.0297393798828125,-0.0274658203125,-0.02032470703125,-0.026580810546875,-0.01253509521484375,-0.07373046875,-0.0169525146484375,0.02374267578125,0.043548583984375,0.0137786865234375,0.06341552734375,0.00617218017578125,0.00588226318359375,0.038604736328125,0.09173583984375,0.006877899169921875,0.0477294921875,0.034454345703125,-0.035003662109375,-0.0288848876953125,-0.0244598388671875,0.038360595703125,0.0038299560546875,-0.0252838134765625,-0.0242767333984375,-0.052520751953125,-0.031494140625,0.0077972412109375,0.02679443359375,0.005016326904296875,0.03607177734375,-0.09747314453125,-0.0237884521484375,0.03521728515625,-0.0355224609375,0.036376953125,0.046783447265625,-0.02178955078125,-0.0174560546875,0.033416748046875,0.038299560546875,0.0168609619140625,0.06182861328125,0.0635986328125,0.07305908203125,0.01074981689453125,0.00968170166015625,-0.017791748046875,0.069091796875,0.0311431884765625,-0.01611328125,-0.052825927734375,0.09954833984375,0.0035381317138671875,-0.0020656585693359375,-0.076171875,-0.028717041015625,0.04595947265625,-0.041900634765625,0.0357666015625,-0.01434326171875,-0.0322265625,-0.045867919921875,-0.2288818359375,0.06658935546875,0.0121307373046875,-0.01100921630859375,0.0286712646484375,-0.033294677734375,0.059295654296875,0.0196990966796875,0.11859130859375,-0.004791259765625,0.0224609375,-0.04632568359375,-0.0022983551025390625,0.0088958740234375,0.0208892822265625,-0.00423431396484375,0.0243072509765625,-0.04266357421875,0.01456451416015625,-0.035247802734375,0.039276123046875,0.002422332763671875,-0.00444793701171875,-0.032623291015625,-0.0177001953125,-0.05419921875,0.1456298828125,0.137939453125,0.062347412109375,-0.0026760101318359375,0.0538330078125,0.0028057098388671875,-0.006610870361328125,-0.208251953125,0.06298828125,0.0158538818359375,-0.044097900390625,-0.06744384765625,-0.11968994140625,0.01715087890625,0.004608154296875,-0.052398681640625,-0.0226593017578125,-0.041748046875,0.006786346435546875,-0.06658935546875,-0.061065673828125,-0.0302886962890625,-0.064208984375,0.047332763671875,0.001125335693359375,-0.050872802734375,0.004459381103515625,0.01959228515625,-0.0259552001953125,-0.07244873046875,-0.04351806640625,-0.060394287109375,-0.02960205078125,0.08026123046875,-0.044342041015625,0.07672119140625,0.01486968994140625,0.053375244140625,-0.003330230712890625,0.0789794921875,-0.0126953125,-0.02587890625,0.061614990234375,-0.0203399658203125,-0.002536773681640625,-0.03326416015625,-0.036590576171875,-0.00762176513671875,-0.00554656982421875,0.033203125,0.052886962890625,0.033935546875,0.0034427642822265625,-0.062744140625,0.03167724609375,0.0069580078125,0.036590576171875,-0.00408935546875,0.023223876953125,0.0211944580078125,-0.006481170654296875,-0.033966064453125,0.026123046875,-0.026458740234375,-0.039642333984375,0.006450653076171875,-0.01071929931640625,-0.1417236328125,0.031280517578125,-0.0509033203125,-0.199951171875,0.0372314453125,-0.007904052734375,-0.0210113525390625,-0.0333251953125,0.00927734375,0.0261383056640625,0.09796142578125,-0.1239013671875,0.0252838134765625,0.02130126953125,0.036468505859375,-0.009246826171875,-0.037628173828125,0.00424957275390625,-0.037994384765625,0.0614013671875,-0.087890625,0.032196044921875,-0.004901885986328125,0.022979736328125,-0.00754547119140625,0.09796142578125,-0.022918701171875,0.10516357421875,0.04327392578125,-0.0024871826171875,0.04644775390625,0.01233673095703125,-0.01806640625,0.0297698974609375,-0.004222869873046875,0.061279296875,-0.0584716796875,0.0243377685546875,-0.0474853515625,-0.07958984375,0.0031185150146484375,0.0084991455078125,-0.03466796875,-0.0179290771484375,-0.01442718505859375,-0.01447296142578125,0.017578125,0.08892822265625,-0.03509521484375,-0.029815673828125,-0.0190277099609375,-0.0204925537109375,-0.01047515869140625,-0.011474609375,-0.01009368896484375,0.02215576171875,0.01282501220703125,0.0390625,-0.0202789306640625,-0.01514434814453125,-0.0189208984375,0.007091522216796875,-0.038970947265625,-0.07720947265625,-0.0031890869140625,0.083984375,0.067626953125,0.01323699951171875]') );
      INSERT INTO message (id, external_id, user_id, role, type, timestamp) VALUES ('mem-4', 'ext-mem-4', '1', 'assistant', 'text', '2025-01-01T10:03:00.000Z');
      INSERT INTO embedding (message_id, sequence, content, embedding) VALUES ('mem-4', 1, 'Hi, I''m fine.', vector32('[-0.0748291015625,-0.051910400390625,0.03955078125,-0.046875,-0.0140838623046875,-0.0171356201171875,0.1346435546875,0.05499267578125,0.026702880859375,-0.00009292364120483398,-0.04534912109375,-0.08807373046875,0.0750732421875,0.021453857421875,-0.03228759765625,0.0130615234375,0.050811767578125,-0.041107177734375,-0.1824951171875,0.00838470458984375,-0.083251953125,0.040435791015625,0.0252227783203125,-0.020263671875,0.0269775390625,0.010894775390625,0.032257080078125,-0.01123046875,-0.00012314319610595703,-0.06878662109375,-0.059906005859375,0.0144805908203125,-0.027374267578125,-0.0004248619079589844,0.0015048980712890625,-0.00431060791015625,-0.01555633544921875,-0.06329345703125,-0.046478271484375,-0.00580596923828125,0.03314208984375,-0.017303466796875,-0.021697998046875,-0.0284576416015625,0.072021484375,-0.031402587890625,0.01424407958984375,0.056854248046875,0.0625,0.00362396240234375,0.036956787109375,0.0501708984375,-0.0267181396484375,0.059173583984375,-0.051605224609375,0.079833984375,0.02392578125,-0.0135955810546875,0.033599853515625,0.00630950927734375,0.0026378631591796875,0.0670166015625,-0.0931396484375,0.05078125,-0.01558685302734375,-0.00885009765625,-0.053375244140625,-0.0643310546875,0.01451873779296875,0.038330078125,0.0227813720703125,0.016693115234375,0.03192138671875,0.03033447265625,0.0238037109375,0.01666259765625,0.049530029296875,-0.041961669921875,-0.033050537109375,0.01446533203125,0.0263519287109375,-0.0465087890625,-0.00701904296875,0.0305938720703125,-0.0129852294921875,0.00804901123046875,-0.01047515869140625,0.055755615234375,-0.055206298828125,-0.0027828216552734375,0.0246734619140625,0.0153045654296875,0.028839111328125,0.08197021484375,-0.01214599609375,-0.03302001953125,0.073486328125,0.002288818359375,-0.01482391357421875,0.1656494140625,-0.061737060546875,-0.0287017822265625,0.045501708984375,-0.044189453125,-0.062225341796875,0.00832366943359375,0.01541900634765625,-0.0087432861328125,0.0234832763671875,-0.07537841796875,0.03204345703125,-0.024322509765625,0.05853271484375,0.038330078125,0.01947021484375,0.060302734375,-0.01611328125,-0.02490234375,0.10699462890625,-0.060333251953125,0.041168212890625,0.0185089111328125,-0.0300140380859375,0.0181732177734375,0.044189453125,-0.0633544921875,0.1094970703125,0.049041748046875,0.046173095703125,0.04095458984375,-0.0023822784423828125,-0.03533935546875,-0.0321044921875,-0.0276031494140625,-0.030975341796875,0.006511688232421875,0.04132080078125,0.0472412109375,0.03533935546875,-0.0199127197265625,-0.06402587890625,-0.1285400390625,-0.097412109375,-0.11383056640625,0.0193939208984375,0.0089874267578125,-0.01052093505859375,0.058349609375,0.0251922607421875,-0.00533294677734375,-0.005535125732421875,0.051177978515625,0.0007262229919433594,-0.06304931640625,0.0032100677490234375,-0.01364898681640625,0.07513427734375,-0.023223876953125,-0.018280029296875,0.0335693359375,0.0201416015625,-0.0430908203125,0.0142822265625,-0.05126953125,-0.0521240234375,-0.058685302734375,0.01328277587890625,0.038421630859375,0.0207672119140625,0.048095703125,0.0933837890625,0.0465087890625,0.046600341796875,0.06317138671875,0.06707763671875,-0.023956298828125,0.0053558349609375,0.058837890625,-0.06292724609375,0.0015096664428710938,-0.0226593017578125,-0.01004791259765625,-0.0160980224609375,-0.0209503173828125,-0.0143280029296875,0.0020618438720703125,-0.07220458984375,0.039886474609375,0.04888916015625,-0.0025634765625,0.0034465789794921875,0.02508544921875,-0.062103271484375,0.05328369140625,-0.0023288726806640625,0.029205322265625,0.017486572265625,-0.01282501220703125,0.027679443359375,0.0189056396484375,-0.0102386474609375,-0.01154327392578125,0.0692138671875,0.038726806640625,0.051849365234375,0.034942626953125,-0.03997802734375,-0.0208740234375,0.0386962890625,0.0184326171875,-0.05157470703125,-0.057464599609375,0.09490966796875,-0.010223388671875,-0.00438690185546875,-0.05242919921875,0.05780029296875,0.06866455078125,-0.058349609375,0.0225982666015625,0.050262451171875,0.005413055419921875,-0.07470703125,-0.19921875,0.034210205078125,-0.0228424072265625,0.01334381103515625,0.027740478515625,-0.07220458984375,0.06365966796875,-0.00021564960479736328,0.0162811279296875,-0.0762939453125,0.0287322998046875,-0.015350341796875,-0.0287017822265625,-0.0284271240234375,-0.01059722900390625,-0.032623291015625,0.01763916015625,-0.0780029296875,0.0213623046875,0.0291290283203125,0.031494140625,-0.0026721954345703125,-0.0499267578125,0.016815185546875,0.01132965087890625,-0.0159912109375,0.2003173828125,0.07330322265625,0.04852294921875,-0.03277587890625,0.0225677490234375,-0.007770538330078125,0.00682830810546875,-0.2271728515625,0.09295654296875,0.09857177734375,-0.073974609375,-0.083251953125,-0.03533935546875,-0.03399658203125,0.00583648681640625,-0.0270233154296875,-0.05426025390625,-0.12890625,-0.049774169921875,-0.08819580078125,-0.04315185546875,0.00731658935546875,-0.08319091796875,0.065185546875,0.0192413330078125,-0.11883544921875,-0.0089263916015625,0.0496826171875,-0.006561279296875,-0.04498291015625,-0.02783203125,-0.0195159912109375,-0.056854248046875,0.0775146484375,-0.017852783203125,0.00046324729919433594,0.018524169921875,0.052886962890625,-0.053009033203125,0.113037109375,0.0291748046875,-0.01480865478515625,0.0275726318359375,-0.00525665283203125,-0.037567138671875,-0.0201568603515625,-0.05267333984375,-0.019561767578125,0.0000947713851928711,0.016510009765625,-0.04852294921875,0.0784912109375,0.01044464111328125,-0.03515625,0.016998291015625,-0.005947113037109375,0.05792236328125,-0.0250091552734375,0.006870269775390625,0.0172576904296875,0.0261993408203125,-0.00905609130859375,0.01291656494140625,-0.0070343017578125,-0.0034046173095703125,0.034881591796875,-0.0260467529296875,-0.0809326171875,0.040435791015625,-0.05242919921875,-0.238525390625,0.0201416015625,-0.04046630859375,-0.06646728515625,-0.0301666259765625,-0.00664520263671875,0.11407470703125,0.0288238525390625,-0.09088134765625,0.044921875,0.00431060791015625,0.08758544921875,0.032257080078125,0.051544189453125,-0.0181427001953125,-0.0231475830078125,-0.0162200927734375,-0.06182861328125,0.02197265625,0.01312255859375,0.055328369140625,0.01337432861328125,0.0291290283203125,0.00390625,0.03424072265625,0.061065673828125,0.00592041015625,0.055511474609375,-0.02130126953125,-0.01971435546875,0.0161895751953125,-0.010345458984375,0.0257568359375,-0.0732421875,0.06622314453125,0.005359649658203125,-0.036376953125,-0.005825042724609375,0.04541015625,0.008941650390625,-0.05389404296875,-0.0165863037109375,0.0248870849609375,0.0302581787109375,0.0697021484375,-0.03192138671875,-0.0193634033203125,0.031951904296875,-0.017242431640625,-0.006610870361328125,-0.01171875,0.00916290283203125,0.03515625,0.003116607666015625,0.0338134765625,0.00986480712890625,-0.01947021484375,0.01178741455078125,0.0162811279296875,-0.07440185546875,-0.0638427734375,0.0323486328125,0.0278778076171875,0.04345703125,-0.033233642578125]') );
    `)
    import.meta.env.MAX_RECENT_MESSAGES = '2'
    import.meta.env.MAX_SIMILAR_MESSAGES = '2'

    const newMessage: IncomingMessage = {
      userExternalId: user.externalId,
      userName: user.name,
      externalId: 'new-similar-msg',
      type: 'text',
      text: 'Hi there, how are you doing?',
    }

    deps.ai.generateEmbeddings.mockReturnValue([
      [
        -0.08380126953125, -0.033355712890625, 0.09051513671875, -0.042236328125,
        -0.0235443115234375, -0.0095977783203125, 0.1351318359375, 0.049041748046875,
        0.0008392333984375, 0.036956787109375, 0.0211944580078125, -0.1046142578125,
        0.03619384765625, 0.025146484375, 0.032073974609375, -0.01824951171875,
        -0.003314971923828125, -0.1251220703125, -0.1571044921875, 0.00785064697265625,
        -0.08184814453125, 0.01476287841796875, -0.044586181640625, -0.023895263671875,
        0.050567626953125, 0.007793426513671875, 0.003971099853515625, -0.01934814453125,
        -0.03826904296875, -0.08544921875, -0.03631591796875, -0.0157928466796875, 0.06134033203125,
        -0.0166778564453125, 0.04803466796875, -0.0214691162109375, -0.013031005859375,
        0.013214111328125, -0.013580322265625, 0.0029697418212890625, 0.03436279296875,
        -0.03900146484375, -0.028656005859375, -0.059539794921875, 0.0250701904296875,
        -0.039154052734375, 0.0181121826171875, -0.0052490234375, -0.01026153564453125,
        -0.00466156005859375, -0.05145263671875, 0.039459228515625, 0.0157928466796875,
        0.024017333984375, 0.0281219482421875, 0.07000732421875, 0.11114501953125,
        -0.0203399658203125, 0.02581787109375, 0.0132598876953125, 0.024627685546875,
        0.0386962890625, -0.12841796875, 0.046112060546875, -0.054473876953125, -0.027679443359375,
        -0.043792724609375, -0.0732421875, -0.0038127899169921875, 0.06402587890625,
        -0.0151214599609375, -0.04534912109375, 0.00429534912109375, 0.0285491943359375,
        0.03729248046875, 0.020263671875, 0.0819091796875, -0.0307769775390625, 0.042938232421875,
        -0.03369140625, 0.03839111328125, -0.03778076171875, -0.014495849609375, 0.033782958984375,
        -0.00775146484375, -0.0186767578125, -0.0217132568359375, 0.07891845703125,
        -0.0207366943359375, -0.034759521484375, -0.0283050537109375, 0.06915283203125,
        0.01056671142578125, 0.0577392578125, -0.019989013671875, -0.0389404296875,
        0.00942230224609375, 0.0599365234375, -0.11175537109375, 0.11151123046875, -0.042236328125,
        0.0089263916015625, 0.156982421875, -0.0643310546875, -0.0249786376953125,
        0.0181121826171875, 0.006488800048828125, -0.018707275390625, 0.02813720703125,
        -0.04986572265625, 0.027008056640625, -0.0255584716796875, 0.034423828125,
        -0.004459381103515625, 0.045745849609375, 0.02410888671875, 0.025909423828125,
        -0.006916046142578125, 0.0606689453125, -0.0587158203125, 0.009674072265625,
        0.02838134765625, -0.008331298828125, -0.024322509765625, 0.116943359375, -0.0789794921875,
        0.1234130859375, 0.05999755859375, -0.00970458984375, 0.0277099609375, 0.03643798828125,
        0.0021686553955078125, -0.07879638671875, 0.006946563720703125, -0.056488037109375,
        0.0240020751953125, 0.0227203369140625, -0.026336669921875, 0.03216552734375,
        0.05303955078125, -0.05279541015625, -0.08892822265625, -0.07183837890625, -0.1363525390625,
        -0.00855255126953125, 0.054290771484375, -0.031494140625, 0.026275634765625,
        0.0218353271484375, 0.0075836181640625, -0.042633056640625, 0.04522705078125,
        -0.0279693603515625, -0.07598876953125, 0.01221466064453125, 0.0205078125, 0.06646728515625,
        0.02099609375, -0.0174407958984375, 0.016815185546875, 0.002933502197265625,
        -0.033905029296875, -0.021728515625, -0.004505157470703125, 0.0256500244140625,
        -0.068359375, -0.00827789306640625, 0.041229248046875, 0.0255126953125, 0.0180816650390625,
        0.06170654296875, 0.035430908203125, 0.003444671630859375, 0.0252532958984375,
        0.10345458984375, 0.00890350341796875, 0.0261993408203125, 0.019073486328125,
        -0.033599853515625, -0.028594970703125, 0.00426483154296875, 0.0253753662109375,
        0.0025348663330078125, -0.037200927734375, -0.007762908935546875, -0.054229736328125,
        -0.00994873046875, 0.0182342529296875, 0.02490234375, 0.014678955078125,
        -0.002140045166015625, -0.09637451171875, -0.0270843505859375, 0.0516357421875,
        -0.0088958740234375, 0.01336669921875, 0.01470184326171875, -0.011077880859375,
        -0.0144500732421875, 0.051544189453125, 0.043060302734375, 0.0054931640625,
        0.045989990234375, 0.07666015625, 0.0721435546875, 0.02569580078125, -0.00978851318359375,
        -0.00928497314453125, 0.054443359375, 0.0648193359375, -0.0085906982421875,
        -0.0648193359375, 0.11297607421875, 0.0006136894226074219, -0.0150909423828125,
        -0.0687255859375, -0.0335693359375, 0.06304931640625, -0.0599365234375, 0.026763916015625,
        0.039764404296875, -0.0190277099609375, -0.0234375, -0.1778564453125, 0.01422882080078125,
        0.015960693359375, -0.001496315002441406, 0.0102386474609375, -0.04168701171875,
        0.07159423828125, 0.04473876953125, 0.09356689453125, 0.0177764892578125,
        -0.0007224082946777344, -0.0458984375, -0.002361297607421875, 0.0096893310546875,
        0.03961181640625, 0.01383209228515625, 0.0288238525390625, -0.090576171875,
        0.003063201904296875, -0.0293731689453125, 0.040557861328125, -0.0020198822021484375,
        0.00928497314453125, -0.0246124267578125, -0.011444091796875, -0.043243408203125,
        0.1363525390625, 0.146728515625, 0.0736083984375, -0.0116119384765625, 0.0243377685546875,
        -0.01314544677734375, 0.01102447509765625, -0.248046875, 0.07843017578125,
        0.0306854248046875, -0.058746337890625, -0.0631103515625, -0.11346435546875,
        -0.01702880859375, -0.0081939697265625, -0.0213775634765625, -0.025115966796875,
        -0.056671142578125, 0.026611328125, -0.04345703125, -0.0226287841796875, -0.07037353515625,
        -0.043212890625, 0.0254364013671875, 0.007450103759765625, -0.07574462890625,
        -0.0168304443359375, 0.012969970703125, -0.025543212890625, -0.055084228515625,
        -0.048980712890625, -0.053985595703125, -0.03338623046875, 0.0733642578125,
        -0.0305023193359375, 0.04888916015625, 0.039398193359375, 0.048187255859375,
        0.0487060546875, 0.058258056640625, 0.0009007453918457031, 0.0021495819091796875,
        0.055755615234375, -0.0171966552734375, 0.0157623291015625, -0.0106964111328125,
        -0.0577392578125, 0.00443267822265625, 0.0217742919921875, 0.038970947265625,
        0.046844482421875, 0.0270233154296875, -0.0048828125, -0.0207672119140625, 0.04290771484375,
        -0.0234527587890625, 0.0282135009765625, -0.0014514923095703125, 0.027008056640625,
        -0.021728515625, -0.036529541015625, -0.022308349609375, 0.04669189453125,
        -0.01158905029296875, -0.03350830078125, 0.0142669677734375, -0.0310516357421875,
        -0.141845703125, -0.002391815185546875, -0.0112457275390625, -0.1529541015625,
        0.0294342041015625, 0.0228424072265625, -0.026885986328125, -0.03704833984375,
        -0.00756072998046875, 0.05206298828125, 0.135498046875, -0.09991455078125,
        0.030242919921875, 0.0472412109375, 0.0556640625, 0.0054168701171875, -0.038665771484375,
        -0.003360748291015625, -0.046875, 0.030517578125, -0.0916748046875, 0.045562744140625,
        0.00353240966796875, 0.0259857177734375, -0.037017822265625, 0.08795166015625,
        -0.001956939697265625, 0.12274169921875, 0.041412353515625, 0.0119781494140625,
        0.05987548828125, 0.01195526123046875, -0.0411376953125, 0.0118255615234375,
        0.005901336669921875, 0.057525634765625, -0.039306640625, 0.0202178955078125,
        -0.039703369140625, -0.0849609375, 0.009613037109375, 0.0231170654296875, -0.04510498046875,
        -0.0164947509765625, -0.03826904296875, -0.0021076202392578125, 0.004146575927734375,
        0.1075439453125, -0.037017822265625, -0.039794921875, -0.01076507568359375,
        -0.00994873046875, -0.0117645263671875, -0.0226898193359375, -0.00618743896484375,
        0.007625579833984375, 0.006191253662109375, 0.022125244140625, -0.01256561279296875,
        -0.028228759765625, -0.0228424072265625, -0.006008148193359375, -0.0604248046875,
        -0.07769775390625, 0.0081024169921875, 0.07537841796875, 0.06536865234375, 0.0360107421875,
      ],
    ])

    await agent(deps, newMessage)

    const aiRespondCall = (deps.ai.respond as any).mock.calls[0]?.[0]
    const messages = aiRespondCall?.messages || []

    // Should have: user profile, similar messages, recent messages, and user message
    expect(messages.length).toBeGreaterThanOrEqual(4)
    // console.log(messages)

    expect(messages[1]!.content).not.toContain('user: Hello, how are you?')
    expect(messages[1]!.content).not.toContain("assistant: Hi, I'm fine.")
  })
})
