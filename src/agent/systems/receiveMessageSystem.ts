import type { IncomingMessage } from '../../infra/chat'
import { USER_PRIORITY } from '../../utils/priorities'
import { Frame } from '../frame'

export async function ReceiveMessageSystem(
  frame: Frame,
  deps: Deps,
  incomingMessage: IncomingMessage
) {
  deps.chat.acknowledgeProcessingMessage(incomingMessage.externalId)

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
