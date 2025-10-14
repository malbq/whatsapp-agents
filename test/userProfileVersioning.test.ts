import { createClient } from '@libsql/client'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { LibSql } from '../src/infra/dbLibSql'

describe('User Profile Versioning', () => {
  const dbPath = join(import.meta.dirname, 'userProfileVersioning.db')
  const storagePath = join(import.meta.dirname, 'storage')
  let db: ReturnType<typeof LibSql.db>
  let dbClient: ReturnType<typeof createClient>

  beforeAll(async () => {
    await Bun.$`mkdir -p ${storagePath}`.nothrow()
    dbClient = createClient({ url: `file:${dbPath}` })
    db = LibSql.db(dbClient)
    await Bun.$`atlas schema apply --env local --url sqlite://file:${dbPath} --auto-approve`.quiet()
  })

  afterAll(async () => {
    try {
      await Bun.$`rm -f ${dbPath}`.nothrow()
      await Bun.$`rm -rf ${storagePath}`.nothrow()
    } catch (error) {
      console.warn('Cleanup error:', error)
    }
  })

  beforeEach(async () => {
    await dbClient.executeMultiple(`
      DELETE FROM user_profile_version;
      DELETE FROM message;
      DELETE FROM user;
    `)
  })

  test('should create profile versions with UUID ordering', async () => {
    const user = await db.persistUser({
      externalId: 'test-user-1',
      name: 'Test User',
    })

    await db.updateUserProfile({
      userId: user.id,
      profile: 'Initial profile',
    })

    await db.updateUserProfile({
      userId: user.id,
      profile: 'Updated profile',
    })

    await db.updateUserProfile({
      userId: user.id,
      profile: 'Final profile',
    })

    const updatedUser = await db.persistUser({
      externalId: 'test-user-1',
      name: 'Test User',
    })
    expect(updatedUser.profile).toBe('Final profile')
  })

  test('should handle profile updates without message ID', async () => {
    const user = await db.persistUser({
      externalId: 'test-user-2',
      name: 'Test User 2',
    })

    await db.updateUserProfile({
      userId: user.id,
      profile: 'Profile without message',
    })

    const updatedUser = await db.persistUser({
      externalId: 'test-user-2',
      name: 'Test User 2',
    })
    expect(updatedUser.profile).toBe('Profile without message')
  })

  test('should maintain separate profiles per user', async () => {
    const user1 = await db.persistUser({
      externalId: 'test-user-3',
      name: 'Test User 3',
    })

    const user2 = await db.persistUser({
      externalId: 'test-user-4',
      name: 'Test User 4',
    })

    await db.updateUserProfile({
      userId: user1.id,
      profile: 'User 1 profile',
    })

    await db.updateUserProfile({
      userId: user2.id,
      profile: 'User 2 profile',
    })

    await db.updateUserProfile({
      userId: user1.id,
      profile: 'User 1 updated profile',
    })

    const updatedUser1 = await db.persistUser({
      externalId: 'test-user-3',
      name: 'Test User 3',
    })
    const updatedUser2 = await db.persistUser({
      externalId: 'test-user-4',
      name: 'Test User 4',
    })

    expect(updatedUser1.profile).toBe('User 1 updated profile')
    expect(updatedUser2.profile).toBe('User 2 profile')
  })
})
