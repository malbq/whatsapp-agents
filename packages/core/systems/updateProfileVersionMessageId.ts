import type { Frame } from '../../agent/default/frame'
import { spreadError } from '../utils/spreadError'

//const logger = getLogger(['app', 'agent', 'updateProfileVersionMessageId'])

export async function updateProfileVersionMessageId(
  { profileVersionId, profileVersionSourceMessageId: messageId }: Frame,
  deps: Deps
): Promise<void> {
  if (!profileVersionId || !messageId) {
    return
  }

  try {
    await deps.db.updateProfileVersionMessageId({ profileVersionId, messageId })

    console.debug('Linked profile version with message ID', { profileVersionId, messageId })
  } catch (error) {
    console.error('Failed to link profile version with message ID', {
      profileVersionId,
      messageId,
      ...spreadError(error),
    })
  }
}
