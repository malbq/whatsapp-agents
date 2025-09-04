import type { AsyncSink, Sink } from '@logtape/logtape'
import { fromAsyncSink } from '@logtape/logtape'

export interface LokiSinkOptions {
  staticLabels?: Record<string, string>
  labelKeys?: string[]
  flushIntervalMs?: number
}

const noOpAsyncSink: Sink = async () => {
  // Discard log entries
}

export function getLokiSink({
  staticLabels = {},
  labelKeys = [],
  flushIntervalMs = 2000,
}: LokiSinkOptions): Sink {
  const endpoint: string | undefined = import.meta.env.LOKI_PUSH_URL
  if (!endpoint) return noOpAsyncSink

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Buffer keyed by JSON stringified labels
  const buffer = new Map<
    string,
    { stream: Record<string, string>; values: Array<[string, string]> }
  >()
  let flushTimer: Timer | undefined

  async function flush() {
    if (!buffer.size) return
    const streams = Array.from(buffer.values())
    buffer.clear()
    const payload = { streams }
    try {
      const response = await fetch(endpoint as string, {
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

  function scheduleFlush() {
    if (flushTimer) return
    flushTimer = setTimeout(async () => {
      flushTimer = undefined
      await flush()
    }, flushIntervalMs) as any
  }

  const asyncSink: AsyncSink = async (record) => {
    const labels: Record<string, string> = { ...staticLabels }
    labels['level'] = record.level
    labels['category'] = record.category.join('.')

    const body: Record<string, unknown> = {
      // Keep message as original array for richer downstream parsing
      message: record.message,
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

    const labelsKey = JSON.stringify(labels)
    const existing = buffer.get(labelsKey)
    if (existing) {
      existing.values.push([tsNs, line])
    } else {
      buffer.set(labelsKey, { stream: labels, values: [[tsNs, line]] })
    }

    scheduleFlush()
  }

  return fromAsyncSink(asyncSink)
}
