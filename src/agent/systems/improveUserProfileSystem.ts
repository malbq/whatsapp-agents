import { getLogger } from '@logtape/logtape'
import { ComponentNotFoundError } from '../../errors'
import { spreadError } from '../../utils/spreadError'
import type { EntityId, Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'improveUserProfile'])

export async function ImproveUserProfileSystem(frame: Frame, deps: Deps, messageEntity: EntityId) {
  try {
    const user = frame.getComponent(frame.USER_ENTITY_ID, 'User')
    if (!user) throw new ComponentNotFoundError(frame.USER_ENTITY_ID, 'User')
    const message = frame.getComponent(messageEntity, 'Message')
    if (!message) throw new ComponentNotFoundError(messageEntity, 'Message')
    const textContent = frame.getComponent(messageEntity, 'TextContent')
    if (!textContent || message.type === 'audio') return

    const messageId = frame.getComponent(messageEntity, 'MessageId')
    if (!messageId) {
      logger.warn('Message ID not found, skipping profile update')
      return
    }
    const improvedProfile = await deps.ai.improveUserProfile({
      profile: user.profile,
      message: textContent.text,
    })
    if (improvedProfile.length > 0) {
      await deps.db.updateUserProfile({
        userId: user.id,
        profile: improvedProfile,
        messageId: messageId.id,
      })
    }
    logger.info('Profile update', { current: user.profile, improved: improvedProfile })
  } catch (error) {
    logger.error('Profile update error', { ...spreadError(error) })
  }
}
