import type { AsyncSink, LogRecord } from '@logtape/logtape'

export function getLocalServerSink(): AsyncSink {
  const endpoint = 'http://localhost:8080/logs'

  return async (record: LogRecord) => {
    const body = {
      timestamp: record.timestamp,
      level: record.level,
      category: record.category.join('.'),
      message: record.message.length > 0 ? record.message.join(' ') : undefined,
      properties: record.properties,
    }

    await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  }
}
