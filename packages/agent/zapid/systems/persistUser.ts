import { spreadError } from '@batman/core/utils/spreadError'
import type { Frame } from '../frame'
import type { Deps } from '../types'

export async function persistUser(
  frame: Frame,
  deps: Deps,
  incomingUser: { userExternalId: string; userName: string }
): Promise<void> {
  console.log(`Persisting incoming user`, incomingUser)
  await deps.db
    .persistUser({
      waId: incomingUser.userExternalId,
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
