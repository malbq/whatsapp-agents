import { getLogger } from '@logtape/logtape'
import { spreadError } from '../../utils/spreadError'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'persistUser'])

export async function persistUser(
  frame: Frame,
  deps: Deps,
  incomingUser: { externalId: string; name: string }
): Promise<void> {
  logger.info(`Incoming user '${incomingUser.externalId}'`, incomingUser)
  await deps.db
    .persistUser(incomingUser)
    .then((user) => {
      frame.user = user
    })
    .catch((error) => {
      logger.error('Error persisting user', {
        ...incomingUser,
        ...spreadError(error),
      })
    })
}
