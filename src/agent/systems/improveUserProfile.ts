import { getLogger } from '@logtape/logtape'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'improveUserProfile'])

export async function ImproveUserProfile(frame: Frame, deps: Deps) {
  if (!frame.user) {
    logger.warn('Skipping profile update: User not found')
    return
  }
  if (!frame.inbound?.text) {
    logger.warn('Skipping profile update: Incoming text not found')
    return
  }

  const improvedProfile = await deps.ai.improveUserProfile({
    profile: frame.user.profile,
    message: frame.inbound.text,
  })

  if (improvedProfile.trim().length === 0) {
    logger.info('Skipping profile update: No improvement found')
    return
  }

  if (improvedProfile === frame.user.profile) {
    logger.warn('Skipping profile update: LLM returned the same profile')
    return
  }

  await deps.db.updateUserProfile({
    userId: frame.user.id,
    profile: improvedProfile,
    messageId: frame.inbound.messageId,
  })
  logger.info('Profile improved')
  logger.debug('Profile diff', { current: frame.user.profile, improved: improvedProfile })
}
