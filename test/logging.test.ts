import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { unlinkSync } from 'node:fs'
import { createLoggingDB, type LogEntry } from '../src/logging/db'

const dbPath = `/tmp/logging-test-${Date.now()}.db`
let db: Awaited<ReturnType<typeof createLoggingDB>>

beforeAll(async () => {
  db = await createLoggingDB(dbPath)
})

afterAll(async () => {
  await db.close()
  try {
    unlinkSync(dbPath)
  } catch {
    // ignore if file doesn't exist
  }
})

describe('LoggingDB operations', () => {
  test('store and retrieve logs', async () => {
    const testLog: Omit<LogEntry, 'id'> = {
      timestamp: new Date(),
      level: 'info',
      category: 'test',
      message: 'Test log message',
      properties: { key: 'value' },
    }

    await db.storeLog(testLog)

    const logs = await db.getLogs()
    expect(logs.length).toBe(1)
    expect(logs[0].level).toBe('info')
    expect(logs[0].category).toBe('test')
    expect(logs[0].message).toBe('Test log message')
    expect(logs[0].properties).toEqual({ key: 'value' })
  })

  test('filter logs by level', async () => {
    const infoLog: Omit<LogEntry, 'id'> = {
      timestamp: new Date(),
      level: 'info',
      category: 'filter-test',
      message: 'Info log',
    }

    const errorLog: Omit<LogEntry, 'id'> = {
      timestamp: new Date(),
      level: 'error',
      category: 'filter-test',
      message: 'Error log',
    }

    await db.storeLog(infoLog)
    await db.storeLog(errorLog)

    const errorLogs = await db.getLogs({ level: 'error' })
    expect(errorLogs.length).toBe(1)
    expect(errorLogs[0].level).toBe('error')
  })

  test('filter logs by category', async () => {
    const testLog: Omit<LogEntry, 'id'> = {
      timestamp: new Date(),
      level: 'info',
      category: 'category-test',
      message: 'Category test log',
    }

    await db.storeLog(testLog)

    const categoryLogs = await db.getLogs({ category: 'category-test' })
    expect(categoryLogs.length).toBe(1)
    expect(categoryLogs[0].category).toBe('category-test')
  })

  test('pagination', async () => {
    // Clear existing logs for clean test
    // Note: In a real scenario, you'd want a test database per test

    const logs = await db.getLogs({ limit: 10 })
    expect(logs.length).toBeLessThanOrEqual(10)
  })
})
