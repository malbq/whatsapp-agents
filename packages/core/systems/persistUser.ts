import type { Frame } from '../../agent/default/frame'
import { spreadError } from '../utils/spreadError'

//const logger = getLogger(['app', 'agent', 'persistUser'])

export async function persistUser(
  frame: Frame,
  deps: Deps,
  incomingUser: { userExternalId: string; userName: string }
): Promise<void> {
  console.log(`Persisting incoming user`, incomingUser)
  await deps.db
    .persistUser({
      externalId: incomingUser.userExternalId,
      name: incomingUser.userName,
    })
    .then((user) => {
      frame.user = user
      console.debug('User persisted', { ...user })
    })
    .catch((error) => {
      console.error('Error persisting user', {
        ...incomingUser,
        ...spreadError(error),
      })
    })
}
