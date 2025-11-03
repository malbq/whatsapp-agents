import type { Message } from '@batman/whatsapp'
import type { UserModelMessage } from 'ai'
import { IngestionError } from '../errors'
import { ingestAudio } from './ingestAudio'
import { ingestDocument } from './ingestDocument'
import { ingestImage } from './ingestImage'
import { ingestVoice } from './ingestVoice'

export async function ingestMessage(message: Message): Promise<UserModelMessage> {
  console.log(`Incoming '${message.type}' message`)
  console.debug('Ingesting message', { ...message })

  let content: string

  switch (message.type) {
    case 'text':
      content = message.text
      break

    case 'voice':
      content = await ingestVoice(message)
      break

    case 'audio':
      content = await ingestAudio(message)
      break

    case 'image':
      content = await ingestImage(message)
      break

    case 'document':
      content = await ingestDocument(message)
      break

    default:
      throw new IngestionError(`Unsupported message type ${message.type}`)
  }

  return {
    role: 'user',
    content,
  }
}
