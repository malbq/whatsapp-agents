import type { Frame } from '../frame'

export async function ResponseDeliverySystem(frame: Frame, deps: Deps) {
  const messagesEntities = frame.query(['Message', 'TextContent'])
  const responseEntities = messagesEntities.filter((messageEntity) => {
    const { role } = frame.getComponent(messageEntity, 'Message')!
    return role === 'assistant'
  })
  if (responseEntities.length === 0) {
    throw new Error('No assistant responses found')
  }

  if (responseEntities.length > 1) {
    console.warn('Multiple assistant responses found')
  }
  const { text } = frame.getComponent(responseEntities[0]!, 'TextContent')!

  const externalId = await deps.chat.sendTextMessage({ text })
  const response = frame.getComponent(responseEntities[0]!, 'Message')!
  frame.addComponent(responseEntities[0]!, 'Message', {
    ...response,
    externalId,
  })
}
