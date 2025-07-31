import { join } from 'node:path'
import { AIProvider } from '../../src/infra/ai'
import type { DbMessageInput } from '../../src/infra/db'

const messages: Array<Pick<DbMessageInput, 'role' | 'type' | 'content'>> = [
  { role: 'user', type: 'text', content: [{ content: 'Hello, how are you?', embedding: [] }] },
  { role: 'assistant', type: 'text', content: [{ content: "Hi, I'm fine.", embedding: [] }] },
  { role: 'user', type: 'text', content: [{ content: "What's the weather like?", embedding: [] }] },
  { role: 'assistant', type: 'text', content: [{ content: "It's sunny today.", embedding: [] }] },
  { role: 'user', type: 'text', content: [{ content: 'Remind me to buy milk.', embedding: [] }] },
  {
    role: 'assistant',
    type: 'text',
    content: [{ content: 'Reminder set for milk.', embedding: [] }],
  },
  { role: 'user', type: 'text', content: [{ content: 'Tell me a joke.', embedding: [] }] },
  {
    role: 'assistant',
    type: 'text',
    content: [
      { content: 'Why did the chicken cross the road? To get to the other side.', embedding: [] },
    ],
  },
]

const embeddings = await AIProvider.generateEmbeddings({
  text: messages.map(({ content }) => content[0]?.content ?? ''),
})

const baseTimestamp = new Date('2025-01-01T10:00:00Z')
const userId = '1'

let sqlInserts = ''
messages.forEach((message, i) => {
  const id = `mem-${i + 1}`
  const timestamp = new Date(baseTimestamp.getTime() + i * 60000).toISOString()
  const embedding = JSON.stringify(embeddings[i])

  sqlInserts +=
    'INSERT INTO message ' +
    '(id, external_id, user_id, role, type, timestamp) ' +
    'VALUES (' +
    `'${id}', ` +
    `'ext-${id}', ` +
    `'${userId}', ` +
    `'${message.role}', ` +
    `'${message.type}', ` +
    `'${timestamp}' ` +
    ');\n'

  sqlInserts +=
    'INSERT INTO embedding ' +
    '(message_id, sequence, content, embedding) ' +
    'VALUES (' +
    `'${id}', ` +
    `1, ` +
    `'${message.content[0]?.content.replace(/'/g, "''") ?? ''}', ` +
    `vector32('${embedding}') ` +
    ');\n'
})

await Bun.write(join(import.meta.dir, '..', 'memory.sql'), sqlInserts)
console.log('Generated memory.sql with test data')
