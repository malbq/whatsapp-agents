import { ComponentNotFoundError } from '../../errors'
import type { EntityId, Frame } from '../frame'

export async function ImproveUserProfileSystem(frame: Frame, deps: Deps, messageEntity: EntityId) {
  const user = frame.getComponent(frame.USER_ENTITY_ID, 'User')
  if (!user) throw new ComponentNotFoundError(frame.USER_ENTITY_ID, 'User')
  const message = frame.getComponent(messageEntity, 'Message')
  if (!message) throw new ComponentNotFoundError(messageEntity, 'Message')
  const textContent = frame.getComponent(messageEntity, 'TextContent')
  if (!textContent || message.type === 'audio') return

  const improvedProfile = await deps.ai.updateUserProfile({
    profile: user.profile,
    message: textContent.text,
  })
  if (improvedProfile.length > 0) {
    await deps.db.updateUserProfile({ userId: user.id, profile: improvedProfile })
  }
}
