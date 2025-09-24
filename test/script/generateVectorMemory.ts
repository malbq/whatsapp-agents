import { basename, dirname, join } from 'node:path'
import { z } from 'zod'
import { AIProvider } from '../../src/infra/ai'

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  type: z.literal('text'),
  content: z
    .array(
      z.object({
        content: z.string().min(1),
        embedding: z.array(z.any()).length(0),
      })
    )
    .length(1),
})

const MessagesSchema = z.array(MessageSchema)

type MessageInput = z.infer<typeof MessageSchema>

function validateMessages(data: unknown): asserts data is MessageInput[] {
  MessagesSchema.parse(data)
}

async function loadMessagesFromFile(filePath: string): Promise<MessageInput[]> {
  try {
    const fileContent = await Bun.file(filePath).text()
    const parsed = JSON.parse(fileContent)
    validateMessages(parsed)
    return parsed
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Invalid JSON structure:', error.errors)
      throw new Error('JSON validation failed')
    }
    throw error
  }
}

function getJsonFilePath(): string {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Usage: bun run generateVectorMemory.ts <path-to-json-file>')
    process.exit(1)
  }
  return filePath
}

const jsonFilePath = getJsonFilePath()
const messages = await loadMessagesFromFile(jsonFilePath)

const embeddings = await AIProvider.generateEmbeddings(
  messages.map(({ content }) => content[0]?.content ?? '').join(' ')
)

const baseTimestamp = new Date('2025-01-01T10:00:00Z')
const userId = '1'

let sqlInserts = ''
messages.forEach((message, i) => {
  const id = `mem-${i + 1}`
  const timestamp = new Date(baseTimestamp.getTime() + i * 60000).toISOString()
  const embedding = JSON.stringify(embeddings[i]!.embedding)

  sqlInserts +=
    'INSERT INTO message ' +
    '(id, external_id, user_id, role, type, timestamp) ' +
    'VALUES (' +
    `'${id}', ` +
    `'ext-${id}', ` +
    `'${userId}', ` +
    `'${message.role}', ` +
    `'${message.type}', ` +
    `'${timestamp}');\n`

  sqlInserts +=
    'INSERT INTO embedding ' +
    '(message_id, sequence, content, embedding) ' +
    'VALUES (' +
    `'${id}', ` +
    `1, ` +
    `'${message.content[0]?.content.replace(/'/g, "''") ?? ''}', ` +
    `vector32('${embedding}'));\n`
})

const inputDir = dirname(jsonFilePath)
const inputBasename = basename(jsonFilePath, '.json')
const outputPath = join(inputDir, `${inputBasename}.sql`)
await Bun.write(outputPath, sqlInserts)
console.log(`Generated ${outputPath} with ${messages.length} messages`)
