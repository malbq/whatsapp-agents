import type { LogRecord } from '@logtape/logtape'
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { getLokiSink } from '../src/config/lokiSink'

const mockFetch = mock(() => Promise.resolve(new Response('', { status: 204 }))) as any
global.fetch = mockFetch as any

const originalEnv = Object.assign({}, import.meta.env)
const env = import.meta.env as unknown as Record<string, any>

describe('LokiSink', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    Object.assign(env, originalEnv)
    env.LOKI_PUSH_URL = 'http://localhost:3100/loki/api/v1/push'
  })

  afterEach(() => {
    mockFetch.mockClear()
    Object.assign(env, originalEnv)
  })

  test('should create sink with basic configuration', () => {
    const sink = getLokiSink({
      staticLabels: { service: 'test' },
    })

    expect(typeof sink).toBe('function')
  })

  test('should format log record correctly', async () => {
    const sink = getLokiSink({
      staticLabels: { service: 'test', env: 'development' },
      labelKeys: ['requestId', 'method'],
    })

    const logRecord = {
      timestamp: Date.now(),
      level: 'info' as const,
      category: ['app'],
      message: ['User logged in'],
      rawMessage: 'User logged in',
      properties: {
        requestId: 'req-123',
        method: 'POST',
        userId: 'user-456',
        nested: { data: { value: 'test' } },
      },
    } satisfies LogRecord

    // Send log
    sink(logRecord)

    // Wait for flush
    await new Promise((resolve) => setTimeout(resolve, 2100))

    expect(mockFetch).toHaveBeenCalledTimes(1)

    const [url, options] = mockFetch.mock.calls[0] as any
    expect(url).toBe('http://localhost:3100/loki/api/v1/push')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')

    const payload = JSON.parse(options.body)
    expect(payload).toHaveProperty('streams')
    expect(payload.streams).toHaveLength(1)

    const stream = payload.streams[0]
    expect(stream.stream).toEqual({
      service: 'test',
      env: 'development',
      level: 'info',
      category: 'app',
      requestId: 'req-123',
      method: 'POST',
    })

    expect(stream.values).toHaveLength(1)
    const [timestamp, line] = stream.values[0]
    expect(timestamp).toMatch(/^\d+$/) // Should be nanosecond timestamp

    const logBody = JSON.parse(line)
    expect(logBody).toMatchObject({
      message: ['User logged in'],
      userId: 'user-456',
      nested: { data: { value: 'test' } }, // Nested structure preserved
    })
    expect(logBody.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  test('should batch multiple log entries with same labels', async () => {
    const sink = getLokiSink({
      staticLabels: { service: 'test' },
    })

    // Send multiple logs quickly
    sink({
      timestamp: Date.now(),
      level: 'info' as const,
      category: ['test'],
      message: ['message 1'],
      rawMessage: 'message 1',
      properties: {},
    })

    sink({
      timestamp: Date.now() + 1,
      level: 'info' as const,
      category: ['test'],
      message: ['message 2'],
      rawMessage: 'message 2',
      properties: {},
    })

    await new Promise((resolve) => setTimeout(resolve, 2100))

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const payload = JSON.parse((mockFetch.mock.calls[0] as any)[1].body)
    expect(payload.streams).toHaveLength(1)
    expect(payload.streams[0].values).toHaveLength(2)
  })

  test('should handle label keys correctly', async () => {
    const sink = getLokiSink({
      staticLabels: { service: 'test' },
      labelKeys: ['requestId'],
    })

    sink({
      timestamp: Date.now(),
      level: 'info' as const,
      category: ['test'],
      message: ['test'],
      rawMessage: 'test',
      properties: {
        requestId: 'req-123',
        userId: 'user-456', // This should go to body, not labels
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 2100))

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const payload = JSON.parse((mockFetch.mock.calls[0] as any)[1].body)
    const stream = payload.streams[0]

    // requestId should be in labels
    expect(stream.stream.requestId).toBe('req-123')

    // userId should be in the log body
    const logBody = JSON.parse(stream.values[0][1])
    expect(logBody.userId).toBe('user-456')
  })
})
