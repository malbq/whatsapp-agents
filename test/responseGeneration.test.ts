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
import { Frame, type FrameMessage } from '../src/agent/frame'
import { recentMessages } from '../src/agent/prompts/recentMessages'
import { userProfile } from '../src/agent/prompts/userProfile'
import { responseGeneration } from '../src/agent/systems/responseGeneration'
import { ResponseGenerationError } from '../src/errors'
import type { Chat } from '../src/infra/chat'
import type { DB, MessageType, User } from '../src/infra/db'
import { LibSql } from '../src/infra/dbLibSql'
import type { Storage } from '../src/infra/storage'

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
  await Bun.$`atlas schema apply --env local --url sqlite://file:${dbPath} --auto-approve`.quiet()

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
    generateEmbeddings: mock(async () => [mockEmbeddings]),
  }

  storage = {
    store: mock(async () => {}),
    retrieve: mock(async () => ({
      data: new ArrayBuffer(0),
      mimeType: 'image/jpeg',
      filename: 'test.jpg',
    })),
  }

  deps = { db, ai, storage, chat: { sendText: mock(async () => 'external-id') } as unknown as Chat }
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
    await Bun.$`rm -f ${dbPath}`.nothrow()
  }
})

describe('ResponseGeneration Module', () => {
  describe('Error Handling', () => {
    test('should throw error when user is not found', async () => {
      const frame = new Frame()
      await expect(responseGeneration(frame, deps)).rejects.toThrow(ResponseGenerationError)
      await expect(responseGeneration(frame, deps)).rejects.toThrow(/User not found/)
    })

    test('should throw error when user message is not found', async () => {
      const frame = new Frame()
      frame.user = createTestUser()
      await expect(responseGeneration(frame, deps)).rejects.toThrow(ResponseGenerationError)
      await expect(responseGeneration(frame, deps)).rejects.toThrow(/User message not found/)
    })

    test('should throw error when both text and transcription are missing', async () => {
      const frame = new Frame()
      frame.user = createTestUser()
      frame.inbound = { type: 'text' as MessageType }
      await expect(responseGeneration(frame, deps)).rejects.toThrow(ResponseGenerationError)
      await expect(responseGeneration(frame, deps)).rejects.toThrow(/User message not found/)
    })
  })

  describe('Context Building', () => {
    const user = createTestUser()
    beforeEach(async () => {
      await insertUserProfile(user)
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
      await responseGeneration(frame, deps)
      expect(ai.respond).toHaveBeenCalledWith({
        messages: [
          { role: 'system', content: userProfile(user.profile) },
          { role: 'system', content: recentMessages },
          { role: 'user', content: 'Previous message' },
          { role: 'assistant', content: 'Previous response' },
          { role: 'user', content: 'Current message' },
        ],
        tools: expect.any(Array),
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
          type: 'audio',
          media: {
            data: new ArrayBuffer(0),
            mimeType: 'audio/ogg',
            transcription: 'Audio transcription text',
          },
        } as FrameMessage,
        expectedMessages: [
          { role: 'system', content: userProfile(user.profile) },
          { role: 'user', content: '[aud] Audio transcription text' },
        ],
      },
      {
        name: 'image message',
        inbound: {
          type: 'image',
          text: 'Image caption',
          media: {
            transcription: 'Image description',
          },
        } as FrameMessage,
        expectedMessages: [
          { role: 'system', content: userProfile(user.profile) },
          { role: 'user', content: '[img] Image description' },
          { role: 'user', content: 'Image caption' },
        ],
      },
      {
        name: 'document message with transcription',
        inbound: {
          type: 'document',
          media: {
            data: new ArrayBuffer(0),
            mimeType: 'application/pdf',
            filename: 'document.pdf',
            transcription: 'Document content',
          },
        } as FrameMessage,
        expectedMessages: [
          { role: 'system', content: userProfile(user.profile) },
          { role: 'user', content: '[doc:document.pdf] Document content' },
        ],
      },
    ])('should handle $name', async ({ inbound, expectedMessages }) => {
      const frame = new Frame()
      frame.user = user
      frame.inbound = inbound
      await responseGeneration(frame, deps)
      expect(ai.respond).toHaveBeenCalledWith({
        messages: expectedMessages,
        tools: expect.any(Array),
      })
    })
  })

  describe('Response Handling', () => {
    const user = createTestUser()
    beforeEach(async () => {
      await insertUserProfile(user)
    })

    test('should handle single message sent via sendText tool', async () => {
      const frame = new Frame()
      frame.user = user
      frame.inbound = { type: 'text' as MessageType, text: 'Hello' }

      ai.respond = mock(async ({ tools }) => {
        const sendTextTool = tools?.find((t: any) => t.name === 'sendText')
        if (sendTextTool) {
          await sendTextTool.execute({ text: 'Hello back!' })
        }
        return {
          text: '',
          usage: { totalTokens: 10, inputTokens: 5, outputTokens: 5 } as LanguageModelUsage,
        }
      })

      await responseGeneration(frame, deps)

      expect(frame.outboundMessages).toHaveLength(1)
      expect(frame.outboundMessages[0]).toMatchObject({
        type: 'text',
        text: 'Hello back!',
        externalChatId: expect.any(String),
      })
    })

    test('should handle multiple messages sent via sendText tool', async () => {
      const frame = new Frame()
      frame.user = user
      frame.inbound = { type: 'text' as MessageType, text: 'Tell me a story' }

      ai.respond = mock(async ({ tools }) => {
        const sendTextTool = tools?.find((t: any) => t.name === 'sendText')
        if (sendTextTool) {
          await sendTextTool.execute({ text: 'Once upon a time...' })
          await sendTextTool.execute({ text: 'There was a brave knight.' })
          await sendTextTool.execute({ text: 'The end!' })
        }
        return {
          text: '',
          usage: { totalTokens: 20, inputTokens: 10, outputTokens: 10 } as LanguageModelUsage,
        }
      })

      await responseGeneration(frame, deps)

      expect(frame.outboundMessages).toHaveLength(3)
      expect(frame.outboundMessages[0]?.text).toBe('Once upon a time...')
      expect(frame.outboundMessages[1]?.text).toBe('There was a brave knight.')
      expect(frame.outboundMessages[2]?.text).toBe('The end!')
      expect(deps.chat.sendText).toHaveBeenCalledTimes(3)
    })

    test('should send fallback response when no sendText calls are made', async () => {
      const frame = new Frame()
      frame.user = user
      frame.inbound = { type: 'text' as MessageType, text: 'Hello' }

      ai.respond = mock(async () => ({
        text: 'Direct response text',
        usage: { totalTokens: 10, inputTokens: 5, outputTokens: 5 } as LanguageModelUsage,
      }))

      await responseGeneration(frame, deps)

      expect(frame.outboundMessages).toHaveLength(1)
      expect(frame.outboundMessages[0]?.text).toBe('Direct response text')
      expect(deps.chat.sendText).toHaveBeenCalledWith({ text: 'Direct response text' })
    })

    test('should handle messages under 500 characters', async () => {
      const frame = new Frame()
      frame.user = user
      frame.inbound = { type: 'text' as MessageType, text: 'Short message' }

      const shortMessage = 'This is a short message under 500 characters.'

      ai.respond = mock(async ({ tools }) => {
        const sendTextTool = tools?.find((t: any) => t.name === 'sendText')
        if (sendTextTool) {
          await sendTextTool.execute({ text: shortMessage })
        }
        return {
          text: '',
          usage: { totalTokens: 10, inputTokens: 5, outputTokens: 5 } as LanguageModelUsage,
        }
      })

      await responseGeneration(frame, deps)

      expect(frame.outboundMessages).toHaveLength(1)
      expect(frame.outboundMessages[0]?.text).toBe(shortMessage)
      expect(shortMessage.length).toBeLessThan(500)
    })

    test('should handle AI response error gracefully', async () => {
      const frame = new Frame()
      frame.user = user
      frame.inbound = { type: 'text' as MessageType, text: 'Hello' }

      ai.respond = mock(async () => {
        throw new Error('AI service error')
      })

      await expect(responseGeneration(frame, deps)).rejects.toThrow('AI service error')

      expect(frame.outboundMessages).toHaveLength(1)
      expect(frame.outboundMessages[0]?.text).toBe(
        'Desculpe, tive algum problema ao tentar te responder.'
      )
    })
  })

  describe('Tool Announcements', () => {
    const user = createTestUser()
    beforeEach(async () => {
      await insertUserProfile(user)
    })

    test('should send preamble before using tools', async () => {
      const frame = new Frame()
      frame.user = user
      frame.inbound = { type: 'text' as MessageType, text: 'Search for restaurants' }

      ai.respond = mock(async ({ tools }) => {
        const sendTextTool = tools?.find((t: any) => t.name === 'sendText')
        if (sendTextTool) {
          await sendTextTool.execute({ text: 'Searching for restaurants nearby...' })
          await sendTextTool.execute({ text: 'Found 3 restaurants.' })
        }
        return {
          text: '',
          usage: { totalTokens: 15, inputTokens: 8, outputTokens: 7 } as LanguageModelUsage,
        }
      })

      await responseGeneration(frame, deps)

      expect(frame.outboundMessages).toHaveLength(2)
      expect(frame.outboundMessages[0]?.text).toContain('Searching')
      expect(frame.outboundMessages[1]?.text).toContain('Found')
    })
  })
})
