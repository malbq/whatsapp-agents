import { getLogger } from '@logtape/logtape'
import type { StatusUpdate } from '../domain'

const logger = getLogger(['app', 'features', 'handleStatusUpdate'])

export async function handleStatusUpdate(statusUpdate: StatusUpdate) {
  logger.info('Status update: {status}', { status: statusUpdate.status })
}
