import { getLogger } from '@logtape/logtape'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'updateProfileVersionMessageId'])

export async function updateProfileVersionMessageId(frame: Frame, deps: Deps): Promise<void> {
  if (!frame.profileVersionId || !frame.inbound?.messageId) {
    return
  }

  const userMessageId = frame.inbound.messageId

  try {
    await deps.db.updateProfileVersionMessageId({
      profileVersionId: frame.profileVersionId,
      messageId: userMessageId,
    })

    logger.debug('Linked profile version with message ID', {
      profileVersionId: frame.profileVersionId,
      messageId: userMessageId,
    })
  } catch (error) {
    logger.error('Failed to link profile version with message ID', {
      profileVersionId: frame.profileVersionId,
      messageId: userMessageId,
      error: String(error),
    })
  }
}
