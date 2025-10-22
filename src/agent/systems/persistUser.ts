import { getLogger } from '@logtape/logtape'
import { spreadError } from '../../utils/spreadError'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'persistUser'])

export async function persistUser(
  frame: Frame,
  deps: Deps,
  incomingUser: { userExternalId: string; userName: string }
): Promise<void> {
  logger.info(`Persisting incoming user`, incomingUser)
  await deps.db
    .persistUser({
      externalId: incomingUser.userExternalId,
      name: incomingUser.userName,
    })
    .then((user) => {
      frame.user = user
      logger.debug('User persisted', { ...user })
    })
    .catch((error) => {
      logger.error('Error persisting user', {
        ...incomingUser,
        ...spreadError(error),
      })
    })
}
