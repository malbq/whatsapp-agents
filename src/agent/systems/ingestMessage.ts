import { getLogger } from '@logtape/logtape'
import { IngestionError } from '../../errors'
import type { IncomingMessage } from '../../infra/chat'
import type { Frame } from '../frame'
import { audioIngest } from './audioIngest'
import { documentIngest } from './documentIngest'
import { imageIngest } from './imageIngest'
import { voiceIngest } from './voiceIngest'

const logger = getLogger(['app', 'agent', 'ingestion'])

export async function IngestMessage(
  frame: Frame,
  deps: Deps,
  message: IncomingMessage
): Promise<void> {
  logger.info(
    `Incoming ${message.type} message from ${message.userName} (${message.userExternalId})`
  )
  logger.debug(`Incoming message: ${message.text}`, { ...message })

  if (message.type === 'text' && !message.text) throw new IngestionError('Text content is required')

  frame.inbound = {
    externalChatId: message.externalId,
    type: message.type,
  }

  if (message.mediaData && message.mimeType) {
    frame.inbound.media = {
      data: message.mediaData,
      mimeType: message.mimeType,
      filename: message.documentFilename,
    }
  }

  switch (frame.inbound.type) {
    case 'text':
      frame.inbound.text = message.text
      break

    case 'voice':
      await voiceIngest(frame, deps)
      break

    case 'audio':
      await audioIngest(frame, deps)
      break

    case 'image':
      frame.inbound.text = message.text
      await imageIngest(frame, deps)
      break

    case 'document':
      frame.inbound.text = message.text
      await documentIngest(frame, deps)
      break

    default:
      frame.outbound = {
        type: 'text',
        text: 'Desculpe, ainda não consigo entender este tipo de mensagem.',
      }
      throw new IngestionError(`Unsupported message type ${message.type}`)
  }
}
