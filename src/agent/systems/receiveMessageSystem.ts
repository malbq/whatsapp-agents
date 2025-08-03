import { getLogger } from '@logtape/logtape'
import type { IncomingMessage } from '../../infra/chat'
import { USER_PRIORITY } from '../../utils/priorities'
import { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'receiveMessage'])

export function ReceiveMessageSystem(frame: Frame, incomingMessage: IncomingMessage) {
  logger.info('Incoming {type} message from {userName}@{externalId}', {
    ...incomingMessage,
  })
  const messageEntity = frame.createEntity()
  frame.addComponent(messageEntity, 'Message', {
    externalId: incomingMessage.externalId,
    role: 'user',
    type: incomingMessage.type,
    priority: USER_PRIORITY,
  })

  if (incomingMessage.mediaData && incomingMessage.mimeType) {
    frame.addComponent(messageEntity, 'Media', {
      data: incomingMessage.mediaData,
      mimeType: incomingMessage.mimeType,
    })
  }

  return messageEntity
}
