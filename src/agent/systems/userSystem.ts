import { getLogger } from '@logtape/logtape'
import type { EntityId, Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'userSystem'])

export async function UserSystem(
  frame: Frame,
  deps: Deps,
  incomingUser: { externalId: string; name: string }
): Promise<EntityId> {
  logger.info('Incoming user {name}@{externalId}', incomingUser)
  const user = await deps.db.persistUser(incomingUser)
  frame.addComponent(frame.USER_ENTITY_ID, 'User', user)
  return frame.USER_ENTITY_ID
}
