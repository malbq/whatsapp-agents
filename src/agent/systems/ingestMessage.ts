import { getLogger } from '@logtape/logtape'
import { IngestionError } from '../../errors'
import type { IncomingMessage } from '../../infra/chat'
import type { Frame } from '../frame'
import { ingestAudio } from './ingestAudio'
import { ingestDocument } from './ingestDocument'
import { ingestImage } from './ingestImage'
import { ingestVoice } from './ingestVoice'

const logger = getLogger(['app', 'agent', 'ingestion'])

export async function ingestMessage(
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
      await ingestVoice(frame, deps)
      break

    case 'audio':
      await ingestAudio(frame, deps)
      break

    case 'image':
      frame.inbound.text = message.text
      await ingestImage(frame, deps)
      break

    case 'document':
      frame.inbound.text = message.text
      await ingestDocument(frame, deps)
      break

    default:
      frame.outbound = {
        type: 'text',
        text: 'Desculpe, ainda não consigo entender este tipo de mensagem.',
      }
      throw new IngestionError(`Unsupported message type ${message.type}`)
  }
}
