import { createClient, type Client } from '@libsql/client'
import type { DB } from './db'

export namespace LibSql {
  export const db = (client?: Client): DB => {
    client =
      client ??
      createClient({
        url: 'file:./storage/db.db',
      })
    return {
      async storeWebhookEvent(payload) {
        await client.execute({
          sql: 'INSERT INTO raw_messages (payload) VALUES (?)',
          args: [payload],
        })
      },
      async findUser(externalId) {
        const selectResult = await client.execute({
          sql: 'SELECT id, external_id, name, joined_at FROM users WHERE external_id = ?',
          args: [externalId],
        })
        if (selectResult.rows.length === 1) {
          const foundUser = selectResult.rows[0]!
          return {
            id: foundUser.id as string,
            externalId: foundUser.external_id as string,
            name: foundUser.name as string,
            joinedAt: new Date(foundUser.joined_at as string),
          }
        }
        if (selectResult.rows.length > 1) {
          throw new Error('Multiple users found with the same external ID')
        }

        return null
      },
      async storeUser(userData) {
        const insertResult = await client.execute({
          sql: 'INSERT INTO users (id, external_id, name, joined_at) VALUES (?, ?, ?, ?)',
          args: [
            Bun.randomUUIDv7(),
            userData.externalId,
            userData.name,
            new Date().toISOString(),
          ],
        })
        if (!insertResult.rowsAffected) {
          throw new Error('Failed to create user')
        }

        const newUser = await this.findUser(userData.externalId)
        if (!newUser) {
          throw new Error('Failed to find user after creation')
        }
        return newUser
      },
    }
  }
}
