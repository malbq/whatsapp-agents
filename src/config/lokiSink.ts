import type { AsyncSink, Sink } from '@logtape/logtape'
import { fromAsyncSink } from '@logtape/logtape'

export interface LokiSinkOptions {
  staticLabels?: Record<string, string>
  labelKeys?: string[]
}

const noOpAsyncSink: Sink = async () => {
  // Discard log entries
}

export function getLokiSink({ staticLabels = {}, labelKeys = [] }: LokiSinkOptions): Sink {
  const endpoint = import.meta.env.LOKI_PUSH_URL
  if (!endpoint) return noOpAsyncSink

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const asyncSink: AsyncSink = async (record) => {
    const labels: Record<string, string> = { ...staticLabels }
    labels['level'] = record.level
    labels['category'] = record.category.join('.')
    const body: Record<string, unknown> = {
      message: Array.isArray(record.message) ? record.message.join(' ') : record.message,
      timestamp: new Date(record.timestamp).toISOString(),
    }

    const properties = (record.properties as Record<string, unknown>) || {}
    for (const [key, value] of Object.entries(properties)) {
      if (value === undefined || value == null) continue
      if (labelKeys.includes(key)) {
        labels[key] = typeof value === 'string' ? value : JSON.stringify(value)
      } else {
        body[key] = value
      }
    }

    const line = JSON.stringify(body)
    const tsNs = String(BigInt(Math.floor(record.timestamp * 1_000_000))) // Convert ms to ns

    const payload = {
      streams: [
        {
          stream: labels,
          values: [[tsNs, line]],
        },
      ],
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        console.error(`Loki sink failed to send logs: ${response.status} ${response.statusText}`)
        const errorText = await response.text().catch(() => 'Unable to read error response')
        console.error('Loki error response:', errorText)
      }
    } catch (error) {
      console.error('Loki sink error:', error)
    }
  }

  return fromAsyncSink(asyncSink)
}
