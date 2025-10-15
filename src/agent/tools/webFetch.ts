import { getLogger } from '@logtape/logtape'
import { tool } from 'ai'
import { z } from 'zod'
import { extractTextFromHTML } from '../../utils/htmlToText'
import { spreadError } from '../../utils/spreadError'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'tool', 'webFetch'])

const DEFAULT_TIMEOUT_MS = 30_000
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024 // 5MB

export const webFetchTool = (_frame: Frame, _deps: Deps) =>
  tool({
    name: 'web_fetch',
    description: `Fetch a URL and return its content. Use this directly when the user's message includes a URL; do not call web_search first. Also use this to read sources discovered by web_search.
- format: "text" (default) converts HTML to plain text via Bun HTMLRewriter; "html" returns raw HTML.
- On errors, returns a short message and continues.
- Maximum response size is 5MB.
- Request timeout is 30 seconds.`,
    inputSchema: z.object({
      url: z.string().describe('The URL to fetch. Must start with http:// or https://'),
      format: z
        .enum(['text', 'html'])
        .optional()
        .default('text')
        .describe('Return format: "text" extracts plain text from HTML, "html" returns raw HTML'),
    }),
    execute: async ({ url, format = 'text' }, { abortSignal }) => {
      try {
        if (!/^https?:\/\//i.test(url)) {
          return 'web_fetch: invalid URL (must start with http:// or https://)'
        }

        logger.debug(`Fetching URL: ${url}`, { format })

        const abortController = new AbortController()
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
        }).catch((e) => {
          logger.error('web_fetch: request failed', { ...spreadError(e) })
          return undefined
        })

        clearTimeout(t)

        if (!resp) return 'web_fetch: network error'
        if (!resp.ok) return `web_fetch: request failed (${resp.status} ${resp.statusText})`

        const lenHeader = resp.headers.get('content-length')
        if (lenHeader && parseInt(lenHeader, 10) > MAX_RESPONSE_SIZE) {
          return 'web_fetch: response too large (exceeds 5MB)'
        }

        const buffer = await resp.arrayBuffer()
        if (buffer.byteLength > MAX_RESPONSE_SIZE) {
          return 'web_fetch: response too large (exceeds 5MB)'
        }

        const contentType = resp.headers.get('content-type') || ''
        const websiteContent = new TextDecoder().decode(buffer)

        logger.debug('Fetch completed', {
          url,
          contentType,
          size: buffer.byteLength,
          format,
        })

        if (format === 'text' && contentType.includes('text/html')) {
          return await extractTextFromHTML(websiteContent)
        }

        return websiteContent
      } catch (error) {
        logger.error('web_fetch: unexpected error', { ...spreadError(error) })
        return `web_fetch: error: ${error instanceof Error ? error.message : 'unknown'}`
      }
    },
  })
