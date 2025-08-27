import { getLogger } from '@logtape/logtape'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'improveUserProfile'])

export async function ImproveUserProfile(frame: Frame, deps: Deps) {
  if (!frame.user) {
    logger.info('User not found, skipping profile update')
    return
  }
  if (!frame.inbound?.text) {
    logger.info('Incoming text not found, skipping profile update')
    return
  }

  const improvedProfile = await deps.ai.improveUserProfile({
    profile: frame.user.profile,
    message: frame.inbound.text,
  })

  if (improvedProfile.length > 0) {
    await deps.db.updateUserProfile({
      userId: frame.user.id,
      profile: improvedProfile,
      messageId: frame.inbound.id,
    })
  }
  logger.info('Profile improved')
  logger.debug('Profile diff', { current: frame.user.profile, improved: improvedProfile })
}
