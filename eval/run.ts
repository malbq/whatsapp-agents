#!/usr/bin/env bun

/**
 * Evaluation Simulation Runner
 *
 * USAGE:
 *   bun run eval/run.ts <config_file>
 *
 * ARGUMENTS:
 *   config_file: Path to JSON simulation configuration file
 *
 * CONFIG FILE FORMAT:
 *   {
 *     "systemPrompt": "System prompt for user message generation",
 *     "model": "OpenAI model name (e.g., 'gpt-5')",
 *     "maxMessages": 10,  // Maximum number of conversation turns
 *     "conversation": [    // Optional: Pre-existing conversation history
 *       {"role": "user", "content": "Hello"},
 *       {"role": "assistant", "content": "Hi there!"}
 *     ]
 *   }
 *
 * OUTPUT:
 *   - Creates a timestamped directory under eval/reports/
 *   - Initializes a fresh SQLite database for the simulation
 *   - Generates JSON report with complete conversation history
 *   - Includes user profile updates and message metadata
 *   - Cache files are stored alongside config files with .embeddings.json extension
 *
 * EXAMPLE:
 *   bun run eval/run.ts scenarios/customer_support.json
 */

import { createXai } from '@ai-sdk/xai'
import { createClient, type Client } from '@libsql/client'
import { generateText } from 'ai'
import crypto from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { z } from 'zod'
import { agent } from '../src/agent'
import { configureEvalLogging } from '../src/config/logging'
import { AIProvider } from '../src/infra/ai'
import type { Chat, IncomingMessage } from '../src/infra/chat'
import { LibSql } from '../src/infra/dbLibSql'
import { FilesystemStorage } from '../src/infra/storageFilesystem'

const xai = createXai({
  apiKey: import.meta.env.XAI_EVAL_API_KEY,
})

async function main() {
  const configFile = process.argv[2]
  if (!configFile) {
    console.error('Provide simulation config JSON path')
    process.exit(1)
  }

  const config = await loadSimulationConfig(configFile)
  const configName = basename(configFile, '.json')
  import.meta.env.NODE_ENV = 'test'
  await configureEvalLogging()

  const runId = newRunId()
  const runDir = join(import.meta.dirname, `/reports/${configName}_${runId}`)
  await mkdir(runDir, { recursive: true })

  const dbPath = join(runDir, `${runId}.db`)
  await Bun.$`atlas schema apply --env local --url sqlite://file:${dbPath} --auto-approve`.quiet()

  const client = createClient({ url: `file:${dbPath}` })
  const deps: Deps = {
    db: LibSql.db(client),
    storage: FilesystemStorage.storage(join(runDir, 'media')),
    chat: evalChat,
    ai: AIProvider,
  }

  const userExternalId = newUserId()
  let predefinedMessageIds = new Set<string>()
  let lastUserMessageContent: string | undefined
  if (config.conversation && config.conversation.length > 0) {
    const cache = await readEmbeddingsCache(configFile, config)
    const result = await insertPredefinedMessages(
      client,
      config.conversation,
      userExternalId,
      cache,
      async (items) => {
        await writeEmbeddingsCache(configFile, config, items)
      }
    )
    predefinedMessageIds = result.messageIds
    const lastMsg = config.conversation[config.conversation.length - 1]
    if (lastMsg && lastMsg.role === 'user') lastUserMessageContent = lastMsg.content
  }

  console.log(`Simulation: ${configName}`)
  console.log(`Max messages: ${config.maxMessages}`)
  console.log('================================')

  if (config.conversation && config.conversation.length > 0) {
    const lastMessage = config.conversation[config.conversation.length - 1]
    if (lastMessage && lastMessage.role === 'user') {
      console.log('Sending predefined user message to agent')
      const incomingMessage = createUserMessage(lastMessage.content, userExternalId)
      await agent(deps, incomingMessage)
    }
  }

  const generateUserMessage = createUserMessageGenerator(config)
  let messageCount = 0

  while (messageCount < config.maxMessages) {
    console.log(`Message ${messageCount + 1}`)

    const userMessage = await generateUserMessage(evalChat.lastAssistantMessage)
    console.log('================================')
    if (!userMessage) break
    const incomingMessage = createUserMessage(userMessage, userExternalId)
    await agent(deps, incomingMessage)

    messageCount++
  }

  const reportData = await generateReportFromDatabase(
    client,
    predefinedMessageIds,
    lastUserMessageContent
  )
  const jsonPath = join(runDir, 'report.json')
  await Bun.write(jsonPath, JSON.stringify(reportData, null, 2))
  console.log(`Report written to ${jsonPath}`)
}

main().catch((e) => {
  console.error('Eval run failed')
  console.error(e)
  process.exit(1)
})

const newRunId = () =>
  new Date()
    .toISOString()
    .replace(/[TZ:.-]/g, '')
    .slice(0, 14)
const newExternalId = () => `waimd.${crypto.randomBytes(4).toString('hex')}`
const newUserId = () => `user_${crypto.randomBytes(4).toString('hex')}`

async function insertPredefinedMessages(
  client: Client,
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>,
  userExternalId: string,
  cache: EmbeddingsCache | undefined,
  persistCache: (items: CachedEmbedding[]) => Promise<void>
): Promise<{ messageIds: Set<string> }> {
  console.log('Inserting predefined conversation messages...')

  const userResult = await client.execute({
    sql: `INSERT INTO user (id, external_id, name)
          VALUES (?, ?, ?)
          ON CONFLICT(external_id) DO UPDATE SET name = excluded.name
          RETURNING id`,
    args: [Bun.randomUUIDv7(), userExternalId, 'Simulated User'],
  })

  if (userResult.rows.length === 0) {
    throw new Error('Failed to create user for predefined messages')
  }

  const actualUserId = userResult.rows[0]?.id as string
  if (!actualUserId) {
    throw new Error('Failed to get user ID from database result')
  }

  const cachedByKey = new Map<string, CachedEmbedding>()
  for (const item of cache?.items ?? []) {
    cachedByKey.set(`${item.role}::${item.content}`, item)
  }

  const cacheItemsToPersist: CachedEmbedding[] = []
  const predefinedMessageIds = new Set<string>()

  const lastMessage = conversation[conversation.length - 1]
  const isLastMessageUser = lastMessage && lastMessage.role === 'user'

  for (let i = 0; i < conversation.length; i++) {
    const message = conversation[i]
    if (!message) continue

    const isLastUserMessage = isLastMessageUser && i === conversation.length - 1

    const messageId = Bun.randomUUIDv7()
    const externalId = newExternalId()
    predefinedMessageIds.add(messageId)

    // do not persist last user message; it will be sent to agent directly

    const key = `${message.role}::${message.content}`
    let chunks: string[]
    let embeddings: number[][]

    const cached = cachedByKey.get(key)
    if (cached) {
      chunks = cached.chunks
      embeddings = cached.embeddings
    } else {
      const messageEmbeddings = await AIProvider.generateEmbeddings(message.content)
      chunks = messageEmbeddings.map((e) => e.content)
      embeddings = messageEmbeddings.map((e) => e.embedding)

      cacheItemsToPersist.push({
        role: message.role,
        content: message.content,
        chunks,
        embeddings,
      })
    }

    if (!isLastUserMessage) {
      const statements = [
        {
          sql: `INSERT INTO message (id, external_id, user_id, role, type, media_storage_key)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [messageId, externalId, actualUserId, message.role, 'text', null],
        },
        ...chunks.map((chunk, sequence) => ({
          sql: `INSERT INTO embedding (message_id, sequence, content, embedding)
                VALUES (?, ?, ?, vector32(?))`,
          args: [messageId, sequence + 1, chunk, JSON.stringify(embeddings[sequence])],
        })),
      ]

      await client.batch(statements)
    }
  }

  if (cacheItemsToPersist.length > 0) {
    await persistCache([...(cache?.items ?? []), ...cacheItemsToPersist])
  }

  console.log(`Inserted ${conversation.length - (isLastMessageUser ? 1 : 0)} predefined messages`)
  return { messageIds: predefinedMessageIds }
}

function createUserMessage(userMessage: string, userExternalId: string): IncomingMessage {
  return {
    externalId: newExternalId(),
    userExternalId,
    userName: 'Simulated User',
    type: 'text',
    text: userMessage,
  }
}

const SimulationConfigSchema = z.object({
  systemPrompt: z.string(),
  maxMessages: z.number(),
  conversation: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string(),
    })
  ),
})
type SimulationConfig = z.infer<typeof SimulationConfigSchema>
async function loadSimulationConfig(file: string): Promise<SimulationConfig> {
  const absPath = join(process.cwd(), file)
  const content = await Bun.file(absPath).text()
  const parsed = JSON.parse(content)
  return SimulationConfigSchema.parse(parsed)
}

type CachedEmbedding = {
  role: 'user' | 'assistant'
  content: string
  chunks: string[]
  embeddings: number[][]
}

type EmbeddingsCache = {
  version: 1
  scenarioPath: string
  scenarioHash: string
  items: CachedEmbedding[]
}

function hashScenarioPayload(payload: SimulationConfig): string {
  const text = JSON.stringify(payload)
  return crypto.createHash('sha256').update(text).digest('hex')
}

async function readEmbeddingsCache(
  configFile: string,
  configPayload: SimulationConfig
): Promise<EmbeddingsCache | undefined> {
  try {
    const absPath = join(process.cwd(), configFile)
    const cachePath = join(dirname(absPath), `${basename(absPath, '.json')}.embeddings.json`)
    const file = await readFile(cachePath, 'utf-8')
    const data = JSON.parse(file) as EmbeddingsCache
    if (data.version !== 1) return undefined
    const expectedHash = hashScenarioPayload(configPayload)
    if (data.scenarioHash !== expectedHash) return undefined
    return data
  } catch {
    return undefined
  }
}

async function writeEmbeddingsCache(
  configFile: string,
  configPayload: SimulationConfig,
  items: CachedEmbedding[]
): Promise<void> {
  const absPath = join(process.cwd(), configFile)
  const cachePath = join(dirname(absPath), `${basename(absPath, '.json')}.embeddings.json`)
  const payload: EmbeddingsCache = {
    version: 1,
    scenarioPath: absPath,
    scenarioHash: hashScenarioPayload(configPayload),
    items,
  }
  await writeFile(cachePath, JSON.stringify(payload, null, 2), 'utf-8')
}

function createUserMessageGenerator(
  config: SimulationConfig
): (message?: string) => Promise<string | null> {
  const modelConfig = xai('grok-4-fast-reasoning')
  let previousResponseId: string | undefined
  let isFirstCall = true

  return async (message?: string): Promise<string | null> => {
    console.log(' > Generating user message...')

    const params: Parameters<typeof generateText>[0] = {
      model: modelConfig,
      system: config.systemPrompt,
      prompt: '',
    }

    if (previousResponseId && message) {
      params.providerOptions!.openai!.previousResponseId = previousResponseId
      params.prompt = message
    } else if (isFirstCall && config.conversation && config.conversation.length > 0) {
      const conversationHistory = config.conversation
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n')
      params.prompt = `Here's the conversation history so far:\n\n${conversationHistory}\n\nContinue the conversation as the user.`
    } else {
      params.prompt = 'Write your first message to the assistant.'
    }

    const response = await generateText(params)

    const userMessage = response.text.trim()
    previousResponseId = response.providerMetadata?.openai?.responseId as string | undefined
    isFirstCall = false

    if (!userMessage) {
      return null
    }

    return userMessage
  }
}
const evalChat: Chat & { lastAssistantMessage?: string } = {
  sendText: async (params) => {
    evalChat.lastAssistantMessage = params.text
    return newExternalId()
  },
  sendImage: async (params) => {
    evalChat.lastAssistantMessage = params.caption
    return newExternalId()
  },
  sendDocument: async (params) => {
    evalChat.lastAssistantMessage = params.caption
    return newExternalId()
  },
  sendLocation: async (params) => {
    evalChat.lastAssistantMessage = params.name || params.address || 'location'
    return newExternalId()
  },
  sendReaction: async (params) => {
    evalChat.lastAssistantMessage = `reaction: ${params.emoji}`
    return newExternalId()
  },
  sendContact: async (params) => {
    evalChat.lastAssistantMessage = `contact: ${params.name}, ${params.phone || 'contact'}`
    return newExternalId()
  },
  sendInteractiveList: async (params) => {
    evalChat.lastAssistantMessage = params.body.text
    return newExternalId()
  },
  sendInteractiveButton: async (params) => {
    evalChat.lastAssistantMessage = params.body.text
    return newExternalId()
  },
  sendInteractiveCtaUrl: async (params) => {
    evalChat.lastAssistantMessage = params.body.text
    return newExternalId()
  },
  sendTemplate: async (params) => {
    evalChat.lastAssistantMessage = params.bodyParameters.join(' ')
    return newExternalId()
  },
  acknowledgeMessage: async (_) => {},
  parseNotification: async (_) => ({}),
}

interface ConversationMessage {
  role: string
  content: string
  type: string
  improvedProfile?: string
  mediaStorageKey?: string
  predefined: boolean
}
async function generateReportFromDatabase(
  client: Client,
  predefinedMessageIds: Set<string>,
  lastUserMessageContent?: string
): Promise<Array<ConversationMessage>> {
  const conversation: Array<ConversationMessage> = []

  const messages = await client.execute({
    sql: `SELECT m.id, m.role, m.type, GROUP_CONCAT(e.content, '') as content, m.timestamp, m.media_storage_key
          FROM message m
          JOIN embedding e ON m.id = e.message_id
          WHERE m.role IN ('user', 'assistant')
          GROUP BY m.id, m.role, m.type, m.timestamp, m.media_storage_key
          ORDER BY m.timestamp`,
  })

  const profileVersions = await client.execute({
    sql: `SELECT user_id, profile, message_id
          FROM user_profile_version
          ORDER BY id`,
  })

  const profileMap = new Map<string, string>()
  for (const row of profileVersions.rows) {
    profileMap.set(row.message_id as string, row.profile as string)
  }

  for (const row of messages.rows) {
    const messageId = row.id as string
    const isLastPredefinedByContent =
      !!lastUserMessageContent &&
      (row.role as string) === 'user' &&
      (row.content as string) === lastUserMessageContent
    const isPredefined = predefinedMessageIds.has(messageId) || isLastPredefinedByContent

    conversation.push({
      role: row.role as string,
      content: row.content as string,
      type: row.type as string,
      improvedProfile: profileMap.get(messageId),
      mediaStorageKey: row.media_storage_key?.toString(),
      predefined: isPredefined,
    })
  }

  if (lastUserMessageContent) {
    const alreadyPresent = conversation.some(
      (m) => m.role === 'user' && m.content === lastUserMessageContent
    )
    if (!alreadyPresent) {
      let insertIndex = conversation.findIndex((m) => m.role === 'assistant')
      if (insertIndex < 0) insertIndex = 0
      conversation.splice(insertIndex, 0, {
        role: 'user',
        content: lastUserMessageContent,
        type: 'text',
        predefined: true,
      })
    }
  }

  return conversation
}
