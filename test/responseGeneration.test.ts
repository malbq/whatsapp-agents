import { createClient, type Client } from '@libsql/client'
import type { LanguageModelUsage } from 'ai'
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
import { Frame } from '../src/agent/frame'
import { FileRetrieval } from '../src/agent/systems/fileRetrieval'
import { ResponseGeneration } from '../src/agent/systems/responseGeneration'
import { ResponseGenerationError } from '../src/errors'
import type { Chat } from '../src/infra/chat'
import type { DB, MessageType, User } from '../src/infra/db'
import { LibSql } from '../src/infra/dbLibSql'
import type { Storage } from '../src/infra/storage'
import { audioTranscription } from '../src/prompts/audioTranscription'
import { documentTranscription } from '../src/prompts/documentTranscription'
import { imageDescription } from '../src/prompts/imageDescription'
import { recentMessages } from '../src/prompts/recentMessages'
import { userProfile } from '../src/prompts/userProfile'

const originalEnv = Object.assign({}, import.meta.env)

const dbPath = `/tmp/response-generation-test-${Date.now()}.db`
let db: DB
let dbClient: Client
let ai: TestDeps['ai']
let storage: Storage
let deps: Deps

const mockEmbeddings = Array.from({ length: 384 }, () => 0.01)

const createTestUser = (): User => ({
  id: '1',
  externalId: 'user-external-id',
  name: 'Test User',
  joinedAt: new Date(),
  profile: 'user profile',
})

const insertUserProfile = async (user: User) => {
  await dbClient.execute(`INSERT INTO user (id, external_id, name) VALUES (?, ?, ?);`, [
    user.id,
    user.externalId,
    user.name,
  ])
  await dbClient.execute(
    `INSERT INTO user_profile_version (id, user_id, profile) VALUES (?, ?, ?);`,
    [Bun.randomUUIDv7(), user.id, user.profile]
  )
}

beforeAll(async () => {
  dbClient = createClient({ url: `file:${dbPath}` })
  db = LibSql.db(dbClient)
  await Bun.$`bun run ./src/infra/dbSetup/init.ts ${dbPath}`

  ai = {
    respond: mock(async () => ({
      text: 'mock response',
      usage: {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
      } as LanguageModelUsage,
    })),
    transcribeAudio: mock(async () => 'transcribed audio'),
    analyzeImage: mock(async () => 'image analysis'),
    transcribeDocument: mock(async () => 'document transcription'),
    improveUserProfile: mock(async () => 'updated profile'),
    generateEmbeddings: mock(async ({ text }: { text: string[] }) =>
      text.map(() => mockEmbeddings)
    ),
  }

  storage = {
    store: mock(async () => {}),
    retrieve: mock(async () => ({
      data: new ArrayBuffer(0),
      mimeType: 'image/jpeg',
      filename: 'test.jpg',
    })),
  }

  deps = { db, ai, storage, chat: {} as Chat }
})

beforeEach(async () => {
  Object.assign(import.meta.env, originalEnv)
})

afterEach(async () => {
  jest.clearAllMocks()
  await dbClient.executeMultiple(`
    DELETE FROM user;
    DELETE FROM message;
    DELETE FROM embedding;
    DELETE FROM user_profile_version;
  `)
})

afterAll(async () => {
  if (dbClient) {
    await dbClient.close()
    await Bun.$`rm -f ${dbPath} 2>/dev/null`
  }
})

describe('ResponseGeneration Module', () => {
  describe('Error Handling', () => {
    test('should throw error when user is not found', async () => {
      const frame = new Frame()
      await expect(ResponseGeneration(frame, deps)).rejects.toThrow(ResponseGenerationError)
      await expect(ResponseGeneration(frame, deps)).rejects.toThrow(/User not found/)
    })

    test('should throw error when user message is not found', async () => {
      const frame = new Frame()
      frame.user = createTestUser()
      await expect(ResponseGeneration(frame, deps)).rejects.toThrow(ResponseGenerationError)
      await expect(ResponseGeneration(frame, deps)).rejects.toThrow(/User message not found/)
    })

    test('should throw error when both text and transcription are missing', async () => {
      const frame = new Frame()
      frame.user = createTestUser()
      frame.inbound = { type: 'text' as MessageType }
      await expect(ResponseGeneration(frame, deps)).rejects.toThrow(ResponseGenerationError)
      await expect(ResponseGeneration(frame, deps)).rejects.toThrow(/User message not found/)
    })
  })

  describe('Context Building', () => {
    const user = createTestUser()
    beforeEach(async () => {
      await insertUserProfile(user)
    })

    test('should include user profile in context when profile exists', async () => {
      const frame = new Frame()
      frame.user = user
      frame.inbound = { type: 'text' as MessageType, text: 'Hello there' }
      await ResponseGeneration(frame, deps)
      expect(ai.respond).toHaveBeenCalledWith({
        messages: [
          { role: 'system', content: userProfile(user.profile) },
          { role: 'user', content: 'Hello there' },
        ],
        searchFilesCallback: expect.any(Function),
      })
    })

    test('should include recent messages in context', async () => {
      await dbClient.executeMultiple(`
        INSERT INTO message (id, external_id, user_id, role, type, timestamp) VALUES 
        ('msg-1', 'ext-1', '1', 'user', 'text', '2025-01-01T10:00:00.000Z'),
        ('msg-2', 'ext-2', '1', 'assistant', 'text', '2025-01-01T10:01:00.000Z');
        INSERT INTO embedding (message_id, sequence, content, embedding) VALUES 
        ('msg-1', 1, 'Previous message', vector32('[${mockEmbeddings.join(',')}]')),
        ('msg-2', 1, 'Previous response', vector32('[${mockEmbeddings.join(',')}]'));
      `)
      const frame = new Frame()
      frame.user = user
      frame.inbound = { type: 'text' as MessageType, text: 'Current message' }
      await ResponseGeneration(frame, deps)
      expect(ai.respond).toHaveBeenCalledWith({
        messages: [
          { role: 'system', content: userProfile(user.profile) },
          { role: 'system', content: recentMessages },
          { role: 'user', content: 'Previous message' },
          { role: 'assistant', content: 'Previous response' },
          { role: 'user', content: 'Current message' },
        ],
        searchFilesCallback: expect.any(Function),
      })
    })

    test('should include similar messages when embeddings are available', async () => {
      await dbClient.executeMultiple(`
        INSERT INTO message (id, external_id, user_id, role, type, timestamp) VALUES 
        ('msg-1', 'ext-1', '1', 'user', 'text', '2025-01-01T10:00:00.000Z'),
        ('msg-2', 'ext-2', '1', 'assistant', 'text', '2025-01-01T10:01:00.000Z');
        INSERT INTO embedding (message_id, sequence, content, embedding) VALUES 
        ('msg-1', 1, 'Similar message', vector32('[${mockEmbeddings.join(',')}]')),
        ('msg-2', 1, 'Similar response', vector32('[${mockEmbeddings.join(',')}]'));
      `)
      const frame = new Frame()
      frame.user = user
      frame.inbound = {
        type: 'text' as MessageType,
        text: 'Current message',
        textEmbedding: [{ content: 'Current message', embedding: mockEmbeddings }],
      }
      await ResponseGeneration(frame, deps)
      expect(ai.respond).toHaveBeenCalledWith({
        messages: [
          { role: 'system', content: userProfile(user.profile) },
          { role: 'system', content: recentMessages },
          { role: 'user', content: 'Similar message' },
          { role: 'assistant', content: 'Similar response' },
          { role: 'user', content: 'Current message' },
        ],
        searchFilesCallback: expect.any(Function),
      })
    })
  })

  describe('Message Type Handling', () => {
    const user = createTestUser()
    beforeEach(async () => {
      await insertUserProfile(user)
    })

    test.each([
      {
        name: 'audio message with transcription',
        inbound: {
          type: 'audio' as MessageType,
          media: {
            data: new ArrayBuffer(0),
            mimeType: 'audio/ogg',
            transcription: 'Audio transcription text',
          },
        },
        expectedMessages: [
          { role: 'system', content: userProfile(user.profile) },
          { role: 'system', content: audioTranscription },
          { role: 'user', content: 'Audio transcription text' },
        ],
      },
      {
        name: 'image message',
        inbound: { type: 'image' as MessageType, text: 'Image caption' },
        expectedMessages: [
          { role: 'system', content: userProfile(user.profile) },
          { role: 'system', content: imageDescription },
          { role: 'user', content: 'Image caption' },
        ],
      },
      {
        name: 'document message with transcription',
        inbound: {
          type: 'document' as MessageType,
          media: {
            data: new ArrayBuffer(0),
            mimeType: 'application/pdf',
            filename: 'document.pdf',
            transcription: 'Document content',
          },
        },
        expectedMessages: [
          { role: 'system', content: userProfile(user.profile) },
          { role: 'system', content: documentTranscription('document.pdf') },
          { role: 'user', content: 'Document content' },
        ],
      },
    ])('should handle $name', async ({ inbound, expectedMessages }) => {
      const frame = new Frame()
      frame.user = user
      frame.inbound = inbound
      await ResponseGeneration(frame, deps)
      expect(ai.respond).toHaveBeenCalledWith({
        messages: expectedMessages,
        searchFilesCallback: expect.any(Function),
      })
    })
  })

  describe('Response Handling', () => {
    const user = createTestUser()
    beforeEach(async () => {
      await insertUserProfile(user)
    })

    test('should set text response in frame outbound', async () => {
      const frame = new Frame()
      frame.user = user
      frame.inbound = { type: 'text' as MessageType, text: 'Hello' }
      ai.respond = mock(async () => ({
        text: 'Hello back!',
        usage: { totalTokens: 10, inputTokens: 5, outputTokens: 5 } as LanguageModelUsage,
      }))
      await ResponseGeneration(frame, deps)
      expect(frame.outbound).toEqual({ type: 'text', text: 'Hello back!' })
    })

    test('should handle response with media storage key', async () => {
      const frame = new Frame()
      frame.user = user
      frame.inbound = { type: 'text' as MessageType, text: 'Generate image' }
      ai.respond = mock(async () => ({
        text: 'Here is your image',
        storageKey: 'image-storage-key',
        usage: { totalTokens: 10, inputTokens: 5, outputTokens: 5 } as LanguageModelUsage,
      }))
      storage.retrieve = mock(async () => ({
        data: new ArrayBuffer(0),
        mimeType: 'image/jpeg',
        filename: 'generated.jpg',
      }))
      await ResponseGeneration(frame, deps)
      expect(frame.outbound).toEqual({
        type: 'text',
        text: 'Here is your image',
        media: { storageKey: 'image-storage-key' },
      })
      await FileRetrieval(frame, deps)
      expect(storage.retrieve).toHaveBeenCalledWith('image-storage-key')
      expect(frame.outbound).toEqual({
        type: 'image',
        text: 'Here is your image',
        media: {
          storageKey: 'image-storage-key',
          data: new ArrayBuffer(0),
          mimeType: 'image/jpeg',
          filename: 'generated.jpg',
        },
      })
    })

    test('should handle AI response error gracefully', async () => {
      const frame = new Frame()
      frame.user = user
      frame.inbound = { type: 'text' as MessageType, text: 'Hello' }
      ai.respond = mock(async () => {
        throw new Error('AI service error')
      })
      await expect(ResponseGeneration(frame, deps)).rejects.toThrow('AI service error')
      expect(frame.outbound).toEqual({
        type: 'text',
        text: 'Desculpe, tive algum problema ao tentar te responder.',
      })
    })

    test('should throw error for unsupported media mime type', async () => {
      const frame = new Frame()
      frame.user = user
      frame.inbound = { type: 'text' as MessageType, text: 'Generate something' }
      ai.respond = mock(async () => ({
        text: 'Generated content',
        storageKey: 'content-storage-key',
        usage: { totalTokens: 10, inputTokens: 5, outputTokens: 5 } as LanguageModelUsage,
      }))
      storage.retrieve = mock(async () => ({
        data: new ArrayBuffer(0),
        mimeType: 'unsupported/type',
        filename: 'content.xyz',
      }))
      await ResponseGeneration(frame, deps)
      await expect(FileRetrieval(frame, deps)).rejects.toThrow(
        /Media with unsupported\/type mime type cannot be sent in response/
      )
    })
  })
})
