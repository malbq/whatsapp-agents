import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { WebSearch } from '../src/infra/webSearch'
import { WebSearchBrave } from '../src/infra/webSearchBrave'

describe('WebSearchBrave', () => {
  let originalFetch: typeof globalThis.fetch
  let mockFetch: ReturnType<typeof mock>
  let searchWeb: WebSearch

  beforeEach(() => {
    originalFetch = globalThis.fetch
    mockFetch = mock()
    globalThis.fetch = mockFetch as any
    searchWeb = WebSearchBrave.searchWeb()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    mockFetch.mockClear()
  })

  const mockSearchResponse = {
    web: {
      results: [
        {
          title: 'Test Result',
          url: 'https://example.com',
          description: 'Test description',
          page_age: '1 day',
          extra_snippets: ['snippet1', 'snippet2'],
        },
      ],
    },
  }

  it('should make normal request and return results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        'x-ratelimit-remaining': '100',
        'x-ratelimit-reset': '60,86400',
      }),
      json: async () => mockSearchResponse,
    })

    const results = await searchWeb({ query: 'test query' })

    expect(results).toEqual([
      {
        url: 'https://example.com',
        title: 'Test Result',
        description: 'Test description',
        age: '1 day',
        snippets: ['snippet1', 'snippet2'],
      },
    ])
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('should handle missing rate limit headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers(),
      json: async () => mockSearchResponse,
    })

    const results = await searchWeb({ query: 'test query' })

    expect(results).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('should queue requests when rate limited', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': '2,86400',
        }),
        json: async () => mockSearchResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'x-ratelimit-remaining': '99',
          'x-ratelimit-reset': '60,86400',
        }),
        json: async () => mockSearchResponse,
      })

    const startTime = Date.now()
    const promises = [searchWeb({ query: 'query 1' }), searchWeb({ query: 'query 2' })]

    const results = await Promise.all(promises)
    const endTime = Date.now()

    expect(results).toHaveLength(2)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(endTime - startTime).toBeGreaterThanOrEqual(2000)
  })

  it('should handle 429 responses by re-queuing', async () => {
    let callCount = 0
    mockFetch.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Headers({
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '1,86400',
          }),
          json: async () => ({}),
        })
      } else {
        return Promise.resolve({
          ok: true,
          headers: new Headers({
            'x-ratelimit-remaining': '99',
            'x-ratelimit-reset': '60,86400',
          }),
          json: async () => mockSearchResponse,
        })
      }
    })

    const result = await searchWeb({ query: 'test query' })

    expect(result).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('should timeout after request timeout', async () => {
    const searchWebWithShortTimeout = WebSearchBrave.searchWeb({
      queueTimeoutMs: 1000,
      requestTimeoutMs: 50,
    })
    mockFetch.mockImplementationOnce((url, options) => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve({
            ok: true,
            headers: new Headers(),
            json: async () => mockSearchResponse,
          })
        }, 100)

        options?.signal?.addEventListener('abort', () => {
          clearTimeout(timeout)
          reject(new Error('The operation was aborted'))
        })
      })
    })

    await expect(searchWebWithShortTimeout({ query: 'test query' })).rejects.toThrow(
      'The operation was aborted'
    )
  })

  it('should process requests sequentially', async () => {
    const callOrder: number[] = []

    mockFetch.mockImplementation((url) => {
      const query = new URL(url).searchParams.get('q')
      const order = query === 'query 1' ? 1 : 2
      callOrder.push(order)

      return Promise.resolve({
        ok: true,
        headers: new Headers({
          'x-ratelimit-remaining': '100',
          'x-ratelimit-reset': '60,86400',
        }),
        json: async () => mockSearchResponse,
      })
    })

    const promises = [searchWeb({ query: 'query 1' }), searchWeb({ query: 'query 2' })]

    await Promise.all(promises)

    expect(callOrder).toEqual([1, 2])
  })

  it('should handle abort signal', async () => {
    const controller = new AbortController()

    mockFetch.mockImplementationOnce((url, options) => {
      expect(options?.signal).toBeDefined()
      return Promise.resolve({
        ok: true,
        headers: new Headers(),
        json: async () => mockSearchResponse,
      })
    })

    await searchWeb({ query: 'test query', signal: controller.signal })

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('should abort request when signal is triggered', async () => {
    const controller = new AbortController()
    controller.abort()

    mockFetch.mockImplementationOnce(() => {
      return new Promise(() => {
        // Never resolve - should be aborted
      })
    })

    await expect(searchWeb({ query: 'test query', signal: controller.signal })).rejects.toThrow(
      'Request aborted'
    )
  })

  it('should handle API errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
    })

    await expect(searchWeb({ query: 'test query' })).rejects.toThrow(
      'Search failed: 500 Internal Server Error'
    )
  })

  it('should handle empty results', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers(),
      json: async () => ({ web: { results: [] } }),
    })

    const results = await searchWeb({ query: 'test query' })

    expect(results).toEqual([])
  })

  it('should handle malformed rate limit headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        'x-ratelimit-remaining': 'invalid',
        'x-ratelimit-reset': 'invalid,also-invalid',
      }),
      json: async () => mockSearchResponse,
    })

    const results = await searchWeb({ query: 'test query' })

    expect(results).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
