import { createClient } from '@libsql/client'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { LibSql } from '../src/infra/dbLibSql'

const dbPath = join(import.meta.dir, 'db.db')
try {
  const db = LibSql.db(
    createClient({
      url: `file:${dbPath}`,
    })
  )
  await Bun.$`bun run ./src/infra/db/init.ts ${dbPath}`

  const testUserInput = {
    externalId: '1234567890',
    name: 'Test User',
  }

  assert.equal(await db.findUser(testUserInput.externalId), null)

  const createdUser = await db.storeUser(testUserInput)
  assert.ok(createdUser.id)
  assert.equal(createdUser.externalId, testUserInput.externalId)
  assert.equal(createdUser.name, testUserInput.name)

  const retrievedUser = await db.findUser(testUserInput.externalId)
  assert.equal(retrievedUser?.id, createdUser.id)
  assert.equal(retrievedUser?.externalId, testUserInput.externalId)
  assert.equal(retrievedUser?.name, testUserInput.name)
} finally {
  await Bun.$`rm ${dbPath}`
}
