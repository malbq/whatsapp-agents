import { createClient, type Client } from '@libsql/client'
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
import type { Chat } from '../src/infra/chat'
import type { DB } from '../src/infra/db'
import { LibSql } from '../src/infra/dbLibSql'
import { runSchedulerTick } from '../src/scheduler/tick'

const dbPath = `/tmp/scheduler-test-${Date.now()}.db`
let db: DB
let chat: Chat
let dbClient: Client

const mockSendTextMessage = mock(async () => 'msg_12345')

describe('Scheduler', () => {
  beforeAll(async () => {
    dbClient = createClient({ url: `file:${dbPath}` })
    db = LibSql.db(dbClient)
    await Bun.$`bun run ./src/infra/dbSetup/init.ts ${dbPath}`

    chat = {
      parseNotification: mock(),
      acknowledgeProcessingMessage: mock(),
      sendTextMessage: mockSendTextMessage,
      sendImageMessage: mock(),
      sendDocumentMessage: mock(),
    }
  })

  afterAll(async () => {
    await dbClient.close()
    await Bun.$`rm -f ${dbPath}`.nothrow()
  })

  beforeEach(() => {
    mockSendTextMessage.mockImplementation(async () => 'msg_12345')
  })

  afterEach(async () => {
    jest.clearAllMocks()
    await dbClient.execute('DELETE FROM reminder')
  })

  test('processes no reminders when none are due', async () => {
    const now = new Date()

    await runSchedulerTick({ db, chat, now })

    // Should not have called sendTextMessage
    expect(mockSendTextMessage).not.toHaveBeenCalled()
  })

  test('processes due reminders successfully', async () => {
    const now = new Date()
    const pastTime = new Date(now.getTime() - 1000) // 1 second ago

    // Create a user first
    const userResult = await db.persistUser({
      externalId: 'user_123',
      name: 'Test User',
    })

    // Create a due reminder
    const reminderResult = await db.createReminder({
      userId: userResult.id,
      dueAt: pastTime,
      description: 'Test reminder',
      message: 'This is a test reminder',
    })

    expect(reminderResult.id).toBeDefined()

    await runSchedulerTick({ db, chat, now })

    // Should have called sendTextMessage once
    expect(mockSendTextMessage).toHaveBeenCalledTimes(1)
    expect(mockSendTextMessage).toHaveBeenCalledWith({
      text: 'This is a test reminder',
      // Note: In real implementation, this would need proper context setup
    })

    // Check that reminder was marked as sent
    const reminders = await db.listUpcomingReminders({ userId: userResult.id })
    expect(reminders.length).toBe(0) // Should be marked as sent, not scheduled
  })

  test('handles multiple due reminders', async () => {
    const now = new Date()
    const pastTime = new Date(now.getTime() - 1000)

    // Create a user
    const userResult = await db.persistUser({
      externalId: 'user_multi',
      name: 'Multi User',
    })

    // Create multiple due reminders
    await db.createReminder({
      userId: userResult.id,
      dueAt: pastTime,
      description: 'Reminder 1',
      message: 'First reminder',
    })

    await db.createReminder({
      userId: userResult.id,
      dueAt: pastTime,
      description: 'Reminder 2',
      message: 'Second reminder',
    })

    await runSchedulerTick({ db, chat, now })

    // Should have called sendTextMessage twice
    expect(mockSendTextMessage).toHaveBeenCalledTimes(2)
    expect(mockSendTextMessage).toHaveBeenNthCalledWith(1, {
      text: 'First reminder',
    })
    expect(mockSendTextMessage).toHaveBeenNthCalledWith(2, {
      text: 'Second reminder',
    })

    // Both reminders should be processed
    const reminders = await db.listUpcomingReminders({ userId: userResult.id })
    expect(reminders.length).toBe(0)
  })

  test('handles failed reminder sending', async () => {
    const now = new Date()
    const pastTime = new Date(now.getTime() - 1000)

    // Create a user
    const userResult = await db.persistUser({
      externalId: 'user_fail',
      name: 'Fail User',
    })

    // Create a reminder
    await db.createReminder({
      userId: userResult.id,
      dueAt: pastTime,
      description: 'Failing reminder',
      message: 'This will fail',
    })

    // Make sendTextMessage throw an error
    mockSendTextMessage.mockRejectedValue(new Error('Network error'))

    await runSchedulerTick({ db, chat, now })

    // Should have tried to send
    expect(mockSendTextMessage).toHaveBeenCalledTimes(1)

    // Reminder should not be in upcoming list (marked as failed)
    const reminders = await db.listUpcomingReminders({ userId: userResult.id })
    expect(reminders.length).toBe(0)
  })

  test('ignores future reminders', async () => {
    const now = new Date()
    const futureTime = new Date(now.getTime() + 60000) // 1 minute in future

    // Create a user
    const userResult = await db.persistUser({
      externalId: 'user_future',
      name: 'Future User',
    })

    // Create a future reminder
    await db.createReminder({
      userId: userResult.id,
      dueAt: futureTime,
      description: 'Future reminder',
      message: 'This is not due yet',
    })

    await runSchedulerTick({ db, chat, now })

    // Should not have called sendTextMessage
    expect(mockSendTextMessage).not.toHaveBeenCalled()

    // Reminder should still be in upcoming list
    const reminders = await db.listUpcomingReminders({ userId: userResult.id })
    expect(reminders.length).toBe(1)
    expect(reminders[0]!.description).toBe('Future reminder')
  })

  test('respects batch size limit', async () => {
    const now = new Date()
    const pastTime = new Date(now.getTime() - 1000)

    // Create a user
    const userResult = await db.persistUser({
      externalId: 'user_batch',
      name: 'Batch User',
    })

    // Create multiple reminders
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        db.createReminder({
          userId: userResult.id,
          dueAt: pastTime,
          description: `Reminder ${i}`,
          message: `Message ${i}`,
        })
      )
    )

    // Run with batch size of 2
    await runSchedulerTick({ db, chat, now, batchSize: 2 })

    // Should have called sendTextMessage only 2 times
    expect(mockSendTextMessage).toHaveBeenCalledTimes(2)
  })

  test('handles reminders for different users', async () => {
    const now = new Date()
    const pastTime = new Date(now.getTime() - 1000)

    // Create two users
    const user1 = await db.persistUser({
      externalId: 'user_1',
      name: 'User One',
    })

    const user2 = await db.persistUser({
      externalId: 'user_2',
      name: 'User Two',
    })

    // Create reminder for each user
    await db.createReminder({
      userId: user1.id,
      dueAt: pastTime,
      description: 'User 1 reminder',
      message: 'Message for user 1',
    })

    await db.createReminder({
      userId: user2.id,
      dueAt: pastTime,
      description: 'User 2 reminder',
      message: 'Message for user 2',
    })

    await runSchedulerTick({ db, chat, now })

    // Should have called sendTextMessage twice (once for each user)
    expect(mockSendTextMessage).toHaveBeenCalledTimes(2)
  })

  test('reclaims stale sending reminders', async () => {
    const now = new Date()
    const pastTime = new Date(now.getTime() - 1000)

    const user = await db.persistUser({
      externalId: 'user_stale',
      name: 'Stale User',
    })

    const { id } = await db.createReminder({
      userId: user.id,
      dueAt: pastTime,
      description: 'Stale sending reminder',
      message: 'Stale should be reclaimed',
    })

    const staleUpdatedAt = new Date(now.getTime() - 10 * 60 * 1000).toISOString()
    await dbClient.execute({
      sql: `UPDATE reminder SET status = 'sending', updated_at = ? WHERE id = ?`,
      args: [staleUpdatedAt, id],
    })

    await runSchedulerTick({ db, chat, now })

    expect(mockSendTextMessage).toHaveBeenCalledTimes(1)
    expect(mockSendTextMessage).toHaveBeenCalledWith({ text: 'Stale should be reclaimed' })
  })

  test('does not reclaim fresh sending reminders', async () => {
    const now = new Date()
    const pastTime = new Date(now.getTime() - 1000)

    const user = await db.persistUser({
      externalId: 'user_fresh',
      name: 'Fresh User',
    })

    const { id } = await db.createReminder({
      userId: user.id,
      dueAt: pastTime,
      description: 'Fresh sending reminder',
      message: 'Fresh should not be reclaimed yet',
    })

    await dbClient.execute({
      sql: `UPDATE reminder SET status = 'sending', updated_at = ? WHERE id = ?`,
      args: [now.toISOString(), id],
    })

    await runSchedulerTick({ db, chat, now })

    expect(mockSendTextMessage).not.toHaveBeenCalled()
  })

  test('takeDueReminders returns status for scheduled items', async () => {
    const now = new Date()
    const pastTime = new Date(now.getTime() - 1000)

    const user = await db.persistUser({
      externalId: 'user_flag_scheduled',
      name: 'Flag Scheduled',
    })

    await db.createReminder({
      userId: user.id,
      dueAt: pastTime,
      description: 'Flag scheduled reminder',
      message: 'Flag scheduled',
    })

    const items = await db.takeDueReminders({ now, limit: 10 })
    expect(items.length).toBe(1)
    expect(items[0]!.isReclaimed).toBe('scheduled')
  })

  test('takeDueReminders returns status for reclaimed sending items', async () => {
    const now = new Date()
    const pastTime = new Date(now.getTime() - 1000)

    const user = await db.persistUser({
      externalId: 'user_flag_sending',
      name: 'Flag Sending',
    })

    const { id } = await db.createReminder({
      userId: user.id,
      dueAt: pastTime,
      description: 'Flag sending reminder',
      message: 'Flag sending',
    })

    const staleUpdatedAt = new Date(now.getTime() - 10 * 60 * 1000).toISOString()
    await dbClient.execute({
      sql: `UPDATE reminder SET status = 'sending', updated_at = ? WHERE id = ?`,
      args: [staleUpdatedAt, id],
    })

    const items = await db.takeDueReminders({ now, limit: 10 })
    expect(items.length).toBe(1)
    expect(items[0]!.isReclaimed).toBe('sending')
  })
})
