import { join } from 'node:path'
import { AIProvider } from '../../src/infra/ai'
import type { DbMessageInput } from '../../src/infra/db'

const messages: Array<Pick<DbMessageInput, 'role' | 'type' | 'content'>> = [
  { role: 'user', type: 'text', content: 'Hello, how are you?' },
  { role: 'assistant', type: 'text', content: "Hi, I'm fine." },
  { role: 'user', type: 'text', content: "What's the weather like?" },
  { role: 'assistant', type: 'text', content: "It's sunny today." },
  { role: 'user', type: 'text', content: 'Remind me to buy milk.' },
  { role: 'assistant', type: 'text', content: 'Reminder set for milk.' },
  { role: 'user', type: 'text', content: 'Tell me a joke.' },
  {
    role: 'assistant',
    type: 'text',
    content: 'Why did the chicken cross the road? To get to the other side.',
  },
]

const embeddings = await AIProvider.generateEmbeddings({
  text: messages.map(({ content }) => content),
})

const baseTimestamp = new Date('2025-01-01T10:00:00Z')
const userId = '1'

let sqlInserts = ''
messages.forEach((message, i) => {
  const id = `mem-${i + 1}`
  const timestamp = new Date(baseTimestamp.getTime() + i * 60000).toISOString() // 1 minute apart
  const embedding = JSON.stringify(embeddings[i])

  sqlInserts +=
    'INSERT INTO message ' +
    '(id, external_id, user_id, role, type, content, timestamp, embedding) ' +
    'VALUES (' +
    `'${id}', ` +
    `'ext-${id}', ` +
    `'${userId}', ` +
    `'${message.role}', ` +
    `'${message.type}', ` +
    `'${message.content.replace(/'/g, "''")}', ` +
    `'${timestamp}', ` +
    `vector32('${embedding}') ` +
    ');\n'
})

await Bun.write(join(import.meta.dir, '..', 'memory.sql'), sqlInserts)
console.log('Generated memory.sql with test data')
