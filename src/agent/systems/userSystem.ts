import chalk from 'chalk'
import type { EntityId, Frame } from '../frame'

export async function UserSystem(
  frame: Frame,
  deps: Deps,
  incomingUser: { externalId: string; name: string }
): Promise<EntityId> {
  console.debug(chalk.green('UserSystem'))
  console.debug(chalk.gray(incomingUser.externalId, incomingUser.name))
  const user = await deps.db.persistUser(incomingUser)
  frame.addComponent(frame.USER_ENTITY_ID, 'User', user)
  return frame.USER_ENTITY_ID
}
