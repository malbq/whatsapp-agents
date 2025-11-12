import type { Message } from '@batman/whatsapp'
import type { AssistantModelMessage, SystemModelMessage, TextPart, UserModelMessage } from 'ai'
import { transcribeAudio } from '../ai/transcribeAudio'

export async function toUserModelMessage(message: Message): Promise<UserModelMessage> {
  switch (message.type) {
    case 'text':
      return { role: 'user', content: [{ type: 'text', text: message.text }] }
    case 'voice':
    case 'audio':
      return {
        role: 'user',
        content: [{ type: 'text', text: await transcribeAudio({ audio: message.data }) }],
      }
    case 'image':
      return {
        role: 'user',
        content: [
          {
            type: 'image',
            image: message.data,
            mediaType: message.mimeType,
          },
          ...(message.caption ? [{ type: 'text', text: message.caption } satisfies TextPart] : []),
        ],
      }
    case 'document':
      return {
        role: 'user',
        content: [
          {
            type: 'file',
            data: message.data,
            mediaType: message.mimeType,
            filename: message.filename,
          },
          ...(message.caption ? [{ type: 'text', text: message.caption } satisfies TextPart] : []),
        ],
      }
    default:
      throw new Error(`Unsupported message type ${message.type}`)
  }
}

export function toAssistantModelMessage(message: Message): AssistantModelMessage {
  switch (message.type) {
    case 'text':
      return { role: 'assistant', content: [{ type: 'text', text: message.text }] }
    default:
      throw new Error(`Unsupported message type ${message.type}`)
  }
}

export function toSystemModelMessage(content: string): SystemModelMessage {
  return { role: 'system', content }
}
