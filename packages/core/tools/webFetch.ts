import { tool } from 'ai'
import { z } from 'zod'
import type { ToolExecutionError } from '../errors'
import { extractTextFromHTML } from '../utils/htmlToText'

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024 // 5MB

export const webFetchTool = tool({
  title: 'web_fetch',
  description: `Fetch a URL and return its content. Use this directly when the user's message includes a URL; do not call web_search first. Also use this to read sources discovered by web_search.
- format: "text" (default) converts HTML to plain text via HTMLRewriter; "html" returns raw HTML.
- On errors, returns a short message and continues.
- Maximum response size is 5MB.
- Request timeout is 30 seconds.
- HTTP URLs will be automatically upgraded to HTTPS`,
  inputSchema: z.object({
    url: z.string().describe('The URL to fetch. Must start with http:// or https://'),
    format: z
      .enum(['text', 'html'])
      .optional()
      .default('text')
      .describe('Return format: "text" extracts plain text from HTML, "html" returns raw HTML'),
  }),
  execute: async (params, { abortSignal }) => {
    const abortController = new AbortController()

    try {
      if (!/^https?:\/\//i.test(params.url)) {
        console.warn('web_fetch invalid URL format', params)
        return 'invalid URL (must start with http:// or https://)'
      }

      const { format = 'text' } = params

      const url = new URL(params.url.replace(/^http:/i, 'https:'))

      const t = setTimeout(() => abortController.abort(), DEFAULT_TIMEOUT_MS)
      abortSignal?.addEventListener('abort', abortController.abort)

      const accept =
        format === 'html'
          ? 'text/html;q=1.0,application/xhtml+xml;q=0.9,text/plain;q=0.5,*/*;q=0.1'
          : 'text/html;q=1.0,text/plain;q=0.9,*/*;q=0.1'

      const resp = await fetch(url, {
        signal: abortController.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36',
          Accept: accept,
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }).catch((error) => {
        console.error('web_fetch request failed', { ...params, error })
        return undefined
      })

      clearTimeout(t)

      if (!resp) {
        console.error('web_fetch no response received', { ...params })
        return 'network error'
      }
      if (!resp.ok) {
        const errorText = await resp.text()
        console.error('web_fetch HTTP error', {
          ...params,
          status: resp.status,
          statusText: resp.statusText,
          error: errorText,
        })
        return `request failed (${resp.status} ${resp.statusText})`
      }

      const lenHeader = resp.headers.get('content-length')
      if (lenHeader && parseInt(lenHeader, 10) > MAX_RESPONSE_SIZE) {
        console.error('web_fetch response too large', {
          ...params,
          declaredSize: parseInt(lenHeader, 10),
          maxSize: MAX_RESPONSE_SIZE,
        })
        return 'response too large (exceeds 5MB)'
      }

      const buffer = await resp.arrayBuffer()
      if (buffer.byteLength > MAX_RESPONSE_SIZE) {
        console.error('web_fetch response too large', {
          ...params,
          actualSize: buffer.byteLength,
          maxSize: MAX_RESPONSE_SIZE,
        })
        return 'response too large (exceeds 5MB)'
      }

      const contentType = resp.headers.get('content-type') || ''
      const websiteContent = new TextDecoder().decode(buffer)

      if (format === 'text' && contentType.includes('text/html')) {
        return await extractTextFromHTML(websiteContent)
      }

      console.debug('web_fetch response', {
        ...params,
        size: buffer.byteLength,
        contentLength: websiteContent.length,
        contentType,
        websiteContent,
        headers: Object.fromEntries(resp.headers),
        status: resp.status,
        statusText: resp.statusText,
        type: resp.type,
      })

      return websiteContent
    } catch (error) {
      console.error('web_fetch failed', { ...params, error })
      return {
        error: 'Tool execution failed',
        details: error instanceof Error ? error.message : 'unknown',
      } satisfies ToolExecutionError
    } finally {
      abortSignal?.removeEventListener('abort', abortController.abort)
    }
  },
})
