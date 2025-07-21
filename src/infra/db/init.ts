import { createClient } from '@libsql/client'
import { join } from 'node:path'

const dbPath = process.argv[2] || './storage/db.db'

export const client = createClient({
  url: `file:${dbPath}`,
})

const usersSchema = await Bun.file(join(import.meta.dir, 'users.sql')).text()
const rawMessagesSchema = await Bun.file(
  join(import.meta.dir, 'raw_messages.sql')
).text()

await client.execute(usersSchema)
await client.execute(rawMessagesSchema)
