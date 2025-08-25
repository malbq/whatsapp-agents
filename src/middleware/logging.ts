import { getLogger, withContext } from '@logtape/logtape'
import { type Context, type Next } from 'hono'
import { spreadError } from '../utils/spreadError'

const logger = getLogger(['server'])

export async function loggingMiddleware(c: Context, next: Next) {
  const requestId = Bun.randomUUIDv7('base64')
  const start = Date.now()

  await withContext(
    {
      requestId,
    },
    async () => {
      logger.debug('Request {requestId}', {
        method: c.req.method,
        path: c.req.path,
        headers: JSON.stringify(c.req.header()),
      })

      try {
        await next()
        logger.debug('Response {requestId}', {
          status: c.res.status,
          duration: time(start),
        })
      } catch (error) {
        logger.error('Request error {requestId}', {
          ...spreadError(error),
          duration: time(start),
        })

        throw error
      }
    }
  )
}
function humanize(times: string[]) {
  const [delimiter, separator] = [',', '.']
  const orderTimes = times.map((v) => v.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + delimiter))
  return orderTimes.join(separator)
}

function time(start: number) {
  const delta = Date.now() - start
  return humanize([delta < 1_000 ? delta + 'ms' : Math.round(delta / 1_000) + 's'])
}
