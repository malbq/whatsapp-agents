import { getLogger } from '@logtape/logtape'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'responseDelivery'])

export async function ResponseDeliverySystem(frame: Frame, deps: Deps) {
  // Handle text messages
  const textMessageEntities = frame.query(['Message', 'TextContent'])
  const textResponseEntities = textMessageEntities.filter((messageEntity) => {
    const { role } = frame.getComponent(messageEntity, 'Message')!
    return role === 'assistant'
  })

  // Handle media messages (images and documents)
  const mediaMessageEntities = frame.query(['Message', 'Media', 'MediaMetadata'])
  const mediaResponseEntities = mediaMessageEntities.filter((messageEntity) => {
    const { role } = frame.getComponent(messageEntity, 'Message')!
    return role === 'assistant'
  })

  // Send text responses
  if (textResponseEntities.length > 0) {
    if (textResponseEntities.length > 1) {
      logger.warn('Multiple assistant text responses found')
    }

    const textEntity = textResponseEntities[0]!
    const textContent = frame.getComponent(textEntity, 'TextContent')!
    const text = textContent.text

    const externalId = await deps.chat.sendTextMessage({ text })
    const response = frame.getComponent(textEntity, 'Message')!
    frame.addComponent(textEntity, 'Message', {
      ...response,
      externalId,
    })
    logger.info`Sent text response: ${text}`
  }

  // Send media responses (prioritized by priority field)
  const sortedMediaEntities = mediaResponseEntities
    .map((entityId) => ({
      entityId,
      message: frame.getComponent(entityId, 'Message')!,
      media: frame.getComponent(entityId, 'Media')!,
      metadata: frame.getComponent(entityId, 'MediaMetadata')!,
    }))
    .sort((a, b) => b.message.priority - a.message.priority) // Higher priority first

  for (const { entityId, message, media, metadata } of sortedMediaEntities) {
    try {
      let externalId: string

      if (message.type === 'image') {
        externalId = await deps.chat.sendImageMessage({
          data: media.data,
          caption: `📎 ${metadata.filename}`,
        })
        logger.info('Sent image response', { filename: metadata.filename })
      } else {
        // Document message
        externalId = await deps.chat.sendDocumentMessage({
          data: media.data,
          filename: metadata.filename || 'document',
          caption: `📎 ${metadata.filename || 'Document'}`,
        })
        logger.info('Sent document response', { filename: metadata.filename })
      }

      // Update the message with external ID
      frame.addComponent(entityId, 'Message', {
        ...message,
        externalId,
      })
    } catch (error) {
      logger.error('Failed to send media response', {
        filename: metadata.filename,
        type: message.type,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Fallback if no responses were generated
  if (textResponseEntities.length === 0 && mediaResponseEntities.length === 0) {
    const fallbackText = 'Desculpe, tive algum problema ao tentar te responder.'
    await deps.chat.sendTextMessage({ text: fallbackText })
    logger.warn('Sent fallback response due to no generated responses')
  }
}
