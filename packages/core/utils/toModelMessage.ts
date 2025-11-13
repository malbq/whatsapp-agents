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
    case 'interactive_button':
      return {
        role: 'assistant',
        content: [
          { type: 'text', text: message.body },
          ...(message.header ? [{ type: 'text', text: `Header: ${message.header}` } satisfies TextPart] : []),
          ...(message.footer ? [{ type: 'text', text: `Footer: ${message.footer}` } satisfies TextPart] : []),
        ],
      }
    case 'interactive_list':
      return {
        role: 'assistant',
        content: [
          { type: 'text', text: message.body },
          ...(message.header ? [{ type: 'text', text: `Header: ${message.header}` } satisfies TextPart] : []),
          ...(message.footer ? [{ type: 'text', text: `Footer: ${message.footer}` } satisfies TextPart] : []),
        ],
      }
    case 'location':
      return {
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: `Location: ${message.name ?? 'Unnamed'} (${message.latitude}, ${message.longitude})${message.address ? ` - ${message.address}` : ''}`,
          },
        ],
      }
    case 'contact':
      return {
        role: 'assistant',
        content: [{ type: 'text', text: `Contact: ${message.name} (${message.phone})` }],
      }
    default:
      throw new Error(`Unsupported message type ${message.type}`)
  }
}

export function toSystemModelMessage(content: string): SystemModelMessage {
  return { role: 'system', content }
}
