import { ok } from 'node:assert'
import { WebSearchError } from '../errors.js'
import { spreadError } from '../utils/spreadError.js'
import type { SearchParams, SearchResult, WebSearch } from './webSearch.js'

ok(import.meta.env.BRAVE_SEARCH_API_KEY, 'BRAVE_SEARCH_API_KEY is required')

interface BraveSearchResult {
  title: string
  url: string
  description: string
  page_age: string
  extra_snippets: Array<string>
}

interface BraveSearchError {
  error: {
    code: string
    detail: string
    meta: {
      component: string
    }
    status: number
  }
  type: string
}

interface BraveSearchResponse {
  web: { results: BraveSearchResult[] }
}

interface QueuedRequest {
  params: SearchParams
  resolve: (value: SearchResult[]) => void
  reject: (error: Error) => void
  timedOut: boolean
}

const DEFAULT_QUEUE_TIMEOUT_MS = 30_000
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

export namespace WebSearchBrave {
  export const createWebSearch = (options?: {
    queueTimeoutMs?: number
    requestTimeoutMs?: number
  }): WebSearch => {
    const QUEUE_TIMEOUT_MS = options?.queueTimeoutMs ?? DEFAULT_QUEUE_TIMEOUT_MS
    const REQUEST_TIMEOUT_MS = options?.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS

    let remainingRequests: number | null = null
    let resetAfter: number | null = null
    let resetCalculatedAt: number | null = null
    let queue: QueuedRequest[] = []

    const defaultSearchParams = new URLSearchParams({
      count: '10',
      offset: '0',
      safesearch: 'strict',
      text_decorations: 'false',
      spellcheck: 'false',
      result_filter: 'web',
      extra_snippets: 'true',
    })

    const defaultHeaders = new Headers({
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': import.meta.env.BRAVE_SEARCH_API_KEY,
    })

    function calculateRemainingWait(): number {
      if (remainingRequests === null || resetAfter === null || resetCalculatedAt === null) {
        return 0
      }

      if (remainingRequests > 0) {
        return 0
      }

      const elapsed = Date.now() - resetCalculatedAt
      const remainingWait = resetAfter - elapsed
      return Math.max(0, remainingWait)
    }

    function updateRateLimitState(response: Response): void {
      const remainingHeader = response.headers.get('x-ratelimit-remaining')
      const resetHeader = response.headers.get('x-ratelimit-reset')

      console.debug('webSearchBrave: update rate limit state from response headers', {
        remainingHeader,
        resetHeader,
      })

      if (remainingHeader !== null) {
        remainingRequests = parseInt(remainingHeader, 10)
      }

      if (resetHeader !== null) {
        const resetValues = resetHeader.split(',').map((v) => v.trim())
        const firstReset = parseInt(resetValues[0] || '0', 10)
        if (!isNaN(firstReset)) {
          resetAfter = firstReset * 1000
          resetCalculatedAt = Date.now()
        }
      }
    }

    async function processNextRequest(): Promise<void> {
      if (queue.length === 0) return
      const queuedRequest = queue[0]!

      console.log('webSearchBrave: processing next request', {
        query: queuedRequest.params.query,
        queueLength: queue.length,
        remainingRequests,
        resetAfter,
        hasSignal: !!queuedRequest.params.signal,
        signalAborted: queuedRequest.params.signal?.aborted,
        timedOut: queuedRequest.timedOut,
      })

      if (queuedRequest.params.signal?.aborted) {
        console.warn('webSearchBrave: request aborted by agent', {
          query: queuedRequest.params.query,
        })
        queuedRequest.reject(new Error('Request aborted'))
        queue.shift()
        return
      }

      if (queuedRequest.timedOut) {
        console.error('webSearchBrave: request timed out in queue', {
          query: queuedRequest.params.query,
          queueTimeoutMs: QUEUE_TIMEOUT_MS,
        })
        queuedRequest.reject(new Error('Request timed out in queue'))
        queue.shift()
        return
      }

      const controller = new AbortController()
      try {
        const remainingWait = calculateRemainingWait()
        if (remainingWait > 0) {
          console.debug('Waiting for rate limit reset', {
            remainingWait,
            remainingRequests,
            resetAfter,
          })
          await new Promise((resolve) => setTimeout(resolve, remainingWait))
        }

        const searchParams = new URLSearchParams(defaultSearchParams)
        searchParams.set('q', queuedRequest.params.query)

        setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
        queuedRequest.params.signal?.addEventListener('abort', controller.abort)

        const requestUrl = `https://api.search.brave.com/res/v1/web/search?${searchParams}`
        console.debug('webSearchBrave: making fetch request', {
          url: requestUrl,
          headers: Object.fromEntries(defaultHeaders.entries()),
          requestTimeoutMs: REQUEST_TIMEOUT_MS,
        })

        const response = await fetch(requestUrl, {
          signal: controller.signal,
          headers: defaultHeaders,
        })

        updateRateLimitState(response)

        if (!response.ok) {
          if (response.status === 429) {
            console.warn('webSearchBrave: rate limit exceeded, re-queuing request', {
              query: queuedRequest.params.query,
              remainingRequests,
              resetAfter,
            })
            processNextRequest()
            return
          }
          let errorResponse: BraveSearchError | undefined
          try {
            errorResponse = (await response.json()) as BraveSearchError
          } catch {
            // ignore JSON parse error
          }

          if (errorResponse) {
            throw new WebSearchError(
              queuedRequest.params.query,
              errorResponse.error.status,
              errorResponse.error.code,
              errorResponse.error.detail
            )
          }

          throw new Error(`Search failed: ${response.status} ${response.statusText}`)
        }

        console.log('webSearchBrave: fetch response received', {
          query: queuedRequest.params.query,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        })

        const jsonResponse = (await response.json()) as BraveSearchResponse
        console.debug('webSearchBrave: JSON parsed successfully', {
          query: queuedRequest.params.query,
          hasWebResults: !!jsonResponse.web?.results,
          resultsCount: jsonResponse.web?.results?.length || 0,
        })

        const {
          web: { results },
        } = jsonResponse

        const searchResults: SearchResult[] = results.map((result) => ({
          url: result.url,
          title: result.title,
          description: result.description,
          age: result.page_age,
          snippets: result.extra_snippets,
        }))

        queuedRequest.resolve(searchResults)

        console.log('webSearchBrave: search request completed successfully', {
          query: queuedRequest.params.query,
          resultsCount: searchResults.length,
        })
        console.debug('webSearchBrave: search request results', {
          query: queuedRequest.params.query,
          searchResults,
        })
      } catch (error) {
        if (error instanceof WebSearchError) {
          console.error('webSearchBrave: API error', {
            query: error.query,
            status: error.status,
            code: error.code,
            detail: error.detail,
          })
        } else {
          console.error('webSearchBrave: search request failed', {
            query: queuedRequest.params.query,
            errorType: (error as Error)?.name,
            errorMessage: (error as Error)?.message,
            isAbortError: (error as Error)?.name === 'AbortError',
            ...spreadError(error),
          })
        }
        queuedRequest.reject(error as Error)
      } finally {
        queuedRequest.params.signal?.removeEventListener('abort', controller.abort)
        queue.shift()
        processNextRequest()
      }
    }

    return (params) => {
      console.log('webSearchBrave: queuing search request', {
        query: params.query,
        hasSignal: !!params.signal,
        signalAborted: params.signal?.aborted,
        queueLength: queue.length,
        remainingRequests,
        resetAfter,
      })

      return new Promise((resolve, reject) => {
        const queuedRequest: QueuedRequest = {
          params,
          resolve,
          reject,
          timedOut: false,
        }
        setTimeout(() => {
          queuedRequest.timedOut = true
        }, QUEUE_TIMEOUT_MS)

        queue.push(queuedRequest)
        console.debug('webSearchBrave: request added to queue', {
          query: params.query,
          newQueueLength: queue.length,
        })

        if (queue.length === 1) {
          console.debug('webSearchBrave: starting queue processing')
          processNextRequest()
        }
      })
    }
  }
}
