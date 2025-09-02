import { getLogger } from '@logtape/logtape'
import { ResponseDeliveryError } from '../../errors'
import { getFileExtensionFromMimeType } from '../../utils/getFileExtensionFromMimeType'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'responseDelivery'])

export async function ResponseDelivery(frame: Frame, deps: Deps) {
  if (!frame.outbound) throw new ResponseDeliveryError('Agent response not defined')
  if (!frame.outbound.text) throw new ResponseDeliveryError('Agent response content is empty')

  if (frame.outbound.type === 'image' && frame.outbound.media) {
    frame.outbound.externalChatId = await deps.chat.sendImageMessage({
      data: frame.outbound.media.data,
      caption: frame.outbound.text,
    })
    logger.info(`Sent image response: ${frame.outbound.text}`)
    return
  }
  if (frame.outbound.type === 'document' && frame.outbound.media) {
    frame.outbound.externalChatId = await deps.chat.sendDocumentMessage({
      data: frame.outbound.media.data,
      caption: frame.outbound.text,
      filename:
        frame.outbound.media.filename ??
        `file.${getFileExtensionFromMimeType(frame.outbound.media.mimeType)}`,
    })
    logger.info(`Sent document response: ${frame.outbound.text}`)
    return
  }

  frame.outbound.externalChatId = await deps.chat.sendTextMessage({
    text: frame.outbound.text,
  })
  logger.info(`Sent text response: ${frame.outbound.text}`)
}
