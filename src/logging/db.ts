import { createClient } from '@libsql/client'

export interface LogEntry {
  id: string
  timestamp: number
  level: string
  category: string
  message?: string
  properties?: Record<string, unknown>
}

export async function createLoggingDB(dbPath: string = './storage/logging.db') {
  const client = createClient({
    url: `file:${dbPath}`,
  })
  await client.execute(`
    CREATE TABLE IF NOT EXISTS logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      message TEXT,
      properties JSONB
    )
  `)

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp ASC)
  `)

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_logs_level ON logs (level)
  `)

  await client.execute(`
    CREATE INDEX IF NOT EXISTS idx_logs_category ON logs (category)
  `)

  const storeLog = async (log: Omit<LogEntry, 'id'>) => {
    try {
      await client.execute({
        sql: `INSERT INTO logs (id, timestamp, level, category, message, properties)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          Bun.randomUUIDv7(),
          new Date(log.timestamp).toISOString(),
          log.level,
          log.category,
          log.message || null,
          log.properties ? JSON.stringify(log.properties) : null,
        ],
      })
    } catch (error) {
      console.error('Failed to store log entry', error)
      throw error
    }
  }

  const getLogs = async (
    params: {
      limit?: number
      offset?: number
      level?: string
      category?: string
    } = {}
  ) => {
    const { limit = 100, offset = 0, level, category } = params

    let whereClause = ''
    const args: (string | number)[] = []

    if (level) {
      whereClause += ' AND level = ?'
      args.push(level)
    }

    if (category) {
      whereClause += ' AND category = ?'
      args.push(category)
    }

    const sql = `SELECT id, timestamp, level, category, message, properties
            FROM logs
            WHERE 1=1 ${whereClause}
            ORDER BY timestamp ASC
            LIMIT ? OFFSET ?`

    const result = await client.execute(sql, [...args, limit, offset])

    return result.rows.map((row) => ({
      id: row.id as string,
      timestamp: new Date(row.timestamp as string),
      level: row.level as string,
      category: row.category as string,
      message: row.message as string | undefined,
      properties: row.properties ? JSON.parse(row.properties as string) : undefined,
    }))
  }

  const close = async () => {
    await client.close()
  }

  return { storeLog, getLogs, close }
}
