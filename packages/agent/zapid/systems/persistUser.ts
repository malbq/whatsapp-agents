import { getContext } from '../context'
import type { UserWithProfile } from '../db'

export async function persistUser(incomingUser: {
  userWaId: string
  userName: string
}): Promise<UserWithProfile | undefined> {
  console.log(`Persisting incoming user`, incomingUser)
  const context = getContext()
  const user = await context.db.persistUser({
    waId: incomingUser.userWaId,
    name: incomingUser.userName,
  })
  context.user = user
  console.debug('User persisted', { ...user })
  return user
}
