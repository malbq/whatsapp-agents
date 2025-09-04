import { getLogger } from '@logtape/logtape'
import { FileRetrievalError } from '../../errors'
import { getMessageTypeFromMimeType } from '../../utils/getMessageTypeFromMimeType'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'fileRetrieval'])

export async function FileRetrieval(frame: Frame, deps: Deps) {
  if (!frame.outbound) {
    throw new FileRetrievalError('Outbound message not found')
  }

  if (!frame.outbound.media?.storageKey) {
    logger.debug('No storage key found in outbound media, skipping file retrieval')
    return
  }

  try {
    const retrievedMedia = await deps.storage.retrieve(frame.outbound.media.storageKey)
    const type = getMessageTypeFromMimeType(retrievedMedia.mimeType)

    if (!type) {
      throw new FileRetrievalError(
        `Media with ${retrievedMedia.mimeType} mime type cannot be sent in response`
      )
    }

    frame.outbound.media.data = retrievedMedia.data
    frame.outbound.media.mimeType = retrievedMedia.mimeType
    frame.outbound.media.filename = retrievedMedia.filename
    frame.outbound.type = type

    logger.info(`File retrieved successfully for storage key: ${frame.outbound.media.storageKey}`, {
      messageType: type,
      mimeType: retrievedMedia.mimeType,
      filename: retrievedMedia.filename,
    })
  } catch (error) {
    frame.outbound = {
      type: 'text',
      text: 'Desculpe, tive algum problema ao encontrar seu arquivo',
    }
    throw error
  }
}
