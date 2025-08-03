import { getLogger } from '@logtape/logtape'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'responseDelivery'])

export async function ResponseDeliverySystem(frame: Frame, deps: Deps) {
  let text = ''
  const messagesEntities = frame.query(['Message', 'TextContent'])
  const responseEntities = messagesEntities.filter((messageEntity) => {
    const { role } = frame.getComponent(messageEntity, 'Message')!
    return role === 'assistant'
  })
  if (responseEntities.length === 0) {
    text = 'Desculpe, tive algum problema ao tentar te responder.'
  }

  if (responseEntities.length > 1) {
    logger.warn('Multiple assistant responses found')
  }
  const textContent = frame.getComponent(responseEntities[0]!, 'TextContent')!
  text = textContent.text

  const externalId = await deps.chat.sendTextMessage({ text })
  const response = frame.getComponent(responseEntities[0]!, 'Message')!
  frame.addComponent(responseEntities[0]!, 'Message', {
    ...response,
    externalId,
  })
  logger.info`Sent text response: ${text}`
}
