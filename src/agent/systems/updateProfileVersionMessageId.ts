import { getLogger } from '@logtape/logtape'
import { spreadError } from '../../utils/spreadError'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'updateProfileVersionMessageId'])

export async function updateProfileVersionMessageId(
  { profileVersionId, profileVersionSourceMessageId: messageId }: Frame,
  deps: Deps
): Promise<void> {
  if (!profileVersionId || !messageId) {
    return
  }

  try {
    await deps.db.updateProfileVersionMessageId({ profileVersionId, messageId })

    logger.debug('Linked profile version with message ID', { profileVersionId, messageId })
  } catch (error) {
    logger.error('Failed to link profile version with message ID', {
      profileVersionId,
      messageId,
      ...spreadError(error),
    })
  }
}
