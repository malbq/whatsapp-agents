import { describe, expect, test } from 'bun:test'
import { createCloudflareCompatibleFetch } from './cloudflareFetch'

function createJsonMockFetch(data: unknown, status = 200) {
  return async () =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' },
    })
}

function createTextMockFetch(text: string, contentType: string, status = 200) {
  return async () =>
    new Response(text, {
      status,
      headers: { 'content-type': contentType },
    })
}

function createStreamMockFetch(chunks: string[]) {
  return async () => {
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk))
        }
        controller.close()
      },
    })
    return new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    })
  }
}

const emptyStreamMockFetch = async () =>
  new Response(null, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })

describe('createCloudflareCompatibleFetch', () => {
  describe('JSON responses', () => {
    test('transforms prompt_tokens and completion_tokens to input_tokens and output_tokens', async () => {
      const mockFetch = createJsonMockFetch({
        id: 'test-123',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      })

      const customFetch = createCloudflareCompatibleFetch(mockFetch as any)
      const response = await customFetch('https://example.com')
      const result = (await response.json()) as any

      expect(result.usage).toHaveProperty('input_tokens', 100)
      expect(result.usage).toHaveProperty('output_tokens', 50)
      expect(result.usage).not.toHaveProperty('prompt_tokens')
      expect(result.usage).not.toHaveProperty('completion_tokens')
      expect(result.usage).toHaveProperty('total_tokens', 150)
    })

    test('does not transform if usage is missing', async () => {
      const mockFetch = createJsonMockFetch({ id: 'test-123', message: 'success' })

      const customFetch = createCloudflareCompatibleFetch(mockFetch as any)
      const response = await customFetch('https://example.com')
      const result = await response.json()

      expect(result).toEqual({ id: 'test-123', message: 'success' })
    })

    test('does not transform if usage is not an object', async () => {
      const mockFetch = createJsonMockFetch({ id: 'test-123', usage: 'invalid' })

      const customFetch = createCloudflareCompatibleFetch(mockFetch as any)
      const response = await customFetch('https://example.com')
      const result = await response.json()

      expect(result).toEqual({ id: 'test-123', usage: 'invalid' })
    })

    test('does not transform if prompt_tokens is missing', async () => {
      const mockFetch = createJsonMockFetch({
        id: 'test-123',
        usage: { completion_tokens: 50 },
      })

      const customFetch = createCloudflareCompatibleFetch(mockFetch as any)
      const response = await customFetch('https://example.com')
      const result = (await response.json()) as any

      expect(result.usage).not.toHaveProperty('input_tokens')
      expect(result.usage).toHaveProperty('completion_tokens', 50)
    })

    test('passes through error responses unchanged', async () => {
      const mockFetch = createJsonMockFetch({ error: 'Not found' }, 404)

      const customFetch = createCloudflareCompatibleFetch(mockFetch as any)
      const response = await customFetch('https://example.com')

      expect(response.status).toBe(404)
      const result = await response.json()
      expect(result).toEqual({ error: 'Not found' })
    })

    test('handles invalid JSON gracefully', async () => {
      const mockFetch = createTextMockFetch('not valid json', 'application/json')

      const customFetch = createCloudflareCompatibleFetch(mockFetch as any)
      const response = await customFetch('https://example.com')

      const text = await response.text()
      expect(text).toBe('not valid json')
    })
  })

  describe('streaming responses', () => {
    test('transforms token usage in SSE data lines', async () => {
      const data = {
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      }
      const mockFetch = createStreamMockFetch([
        `data: ${JSON.stringify(data)}\n\ndata: [DONE]\n\n`,
      ])

      const customFetch = createCloudflareCompatibleFetch(mockFetch as any)
      const response = await customFetch('https://example.com')
      const text = await response.text()

      expect(text).toContain('input_tokens')
      expect(text).toContain('output_tokens')
      expect(text).not.toContain('prompt_tokens')
      expect(text).not.toContain('completion_tokens')
      expect(text).toContain('data: [DONE]')
    })

    test('passes through SSE data lines without usage unchanged', async () => {
      const mockFetch = createStreamMockFetch([
        'data: {"id":"123","message":"hello"}\n\ndata: [DONE]\n\n',
      ])

      const customFetch = createCloudflareCompatibleFetch(mockFetch as any)
      const response = await customFetch('https://example.com')
      const text = await response.text()

      expect(text).toContain('{"id":"123","message":"hello"}')
      expect(text).toContain('data: [DONE]')
    })

    test('handles invalid JSON in SSE gracefully', async () => {
      const mockFetch = createStreamMockFetch(['data: not valid json\n\ndata: [DONE]\n\n'])

      const customFetch = createCloudflareCompatibleFetch(mockFetch as any)
      const response = await customFetch('https://example.com')
      const text = await response.text()

      expect(text).toContain('data: not valid json')
      expect(text).toContain('data: [DONE]')
    })

    test('handles empty stream body', async () => {
      const customFetch = createCloudflareCompatibleFetch(emptyStreamMockFetch as any)
      const response = await customFetch('https://example.com')

      expect(response.status).toBe(200)
      expect(response.body).toBeNull()
    })
  })

  describe('non-JSON/non-streaming responses', () => {
    test('passes through text/html unchanged', async () => {
      const mockFetch = createTextMockFetch('<html><body>Hello</body></html>', 'text/html')

      const customFetch = createCloudflareCompatibleFetch(mockFetch as any)
      const response = await customFetch('https://example.com')
      const text = await response.text()

      expect(text).toBe('<html><body>Hello</body></html>')
    })

    test('passes through binary data unchanged', async () => {
      const buffer = new Uint8Array([1, 2, 3, 4, 5])
      const mockFetch = async () =>
        new Response(buffer, {
          status: 200,
          headers: { 'content-type': 'application/octet-stream' },
        })

      const customFetch = createCloudflareCompatibleFetch(mockFetch as any)
      const response = await customFetch('https://example.com')
      const result = await response.arrayBuffer()

      expect(new Uint8Array(result)).toEqual(new Uint8Array([1, 2, 3, 4, 5]))
    })
  })
})
