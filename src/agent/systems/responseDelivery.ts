import { getLogger } from '@logtape/logtape'
import { ResponseDeliveryError } from '../../errors'
import { getFileExtensionFromMimeType } from '../../utils/getFileExtensionFromMimeType'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'responseDelivery'])

export async function ResponseDelivery(frame: Frame, deps: Deps) {
  if (!frame.user) throw new ResponseDeliveryError('User not found')
  if (!frame.outbound) throw new ResponseDeliveryError('Agent response not defined')
  if (!frame.outbound.text) throw new ResponseDeliveryError('Agent response content is empty')

  if (
    frame.outbound.type === 'image' &&
    frame.outbound.media?.data &&
    frame.outbound.media?.mimeType
  ) {
    frame.outbound.externalChatId = await deps.chat.sendImageMessage({
      data: frame.outbound.media.data,
      caption: frame.outbound.text,
      mimeType: frame.outbound.media.mimeType,
    })
    logger.info(`Sent image response to ${frame.user.name} (${frame.user.externalId})`)
    logger.debug(`Image response: ${frame.outbound.text}`, { ...frame.outbound })
    return
  }
  if (
    frame.outbound.type === 'document' &&
    frame.outbound.media?.data &&
    frame.outbound.media?.mimeType
  ) {
    frame.outbound.externalChatId = await deps.chat.sendDocumentMessage({
      data: frame.outbound.media.data,
      caption: frame.outbound.text,
      filename:
        frame.outbound.media.filename ??
        `file.${getFileExtensionFromMimeType(frame.outbound.media.mimeType)}`,
      mimeType: frame.outbound.media.mimeType,
    })
    logger.info(`Sent document response to ${frame.user.name} (${frame.user.externalId})`)
    logger.debug(`Document response: ${frame.outbound.text}`, { ...frame.outbound })
    return
  }

  frame.outbound.externalChatId = await deps.chat.sendTextMessage({
    text: frame.outbound.text,
  })
  logger.info(`Sent text response to ${frame.user.name} (${frame.user.externalId})`)
  logger.debug(`Text response: ${frame.outbound.text}`, { ...frame.outbound })
}
