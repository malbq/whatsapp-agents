import type { OutgoingMessage } from '@batman/whatsapp'
import type { AssistantModelMessage, SystemModelMessage, TextPart, UserModelMessage } from 'ai'
import type { IncominMessage } from '../../whatsapp/types'
import { transcribeAudio } from '../ai/transcribeAudio'

export async function toUserModelMessage(
  message: IncominMessage
): Promise<UserModelMessage | undefined> {
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
    case 'location':
      return {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `<location>${message.name ? `\n<name>${message.name}</name>` : ''}${
              message.address ? `\n<address>${message.address}</address>` : ''
            }\n<latitude>${message.latitude}</latitude>\n<longitude>${
              message.longitude
            }</longitude>\n</location>`,
          } satisfies TextPart,
        ],
      }
    case 'contact':
      return {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `<contact>${message.name ? `\n<name>${message.name}</name>` : ''}\n<phone>${
              message.phone
            }</phone>\n</contact>`,
          } satisfies TextPart,
        ],
      }
    case 'reaction':
      return
    default: {
      // Prevent forgetting to handle a message type: Type '{ type: "video"; ... }' is not assignable to type 'never'
      const _exhaustive: never = message
      throw new Error(`Unsupported message type: ${(message as IncominMessage).type}`)
    }
  }
}

export function toAssistantModelMessage(
  message: OutgoingMessage
): AssistantModelMessage | undefined {
  switch (message.type) {
    case 'text':
      return { role: 'assistant', content: [{ type: 'text', text: message.text }] }
    case 'interactive_button':
    case 'interactive_list':
    case 'interactive_cta_url':
    case 'location':
    case 'contact':
    case 'template':
    case 'image':
    case 'document':
      return {
        role: 'assistant',
        content: [{ type: 'text', text: JSON.stringify(message) }],
      }
    case 'reaction':
      return // TODO should we care about reaction messages?
    default: {
      // Prevent forgetting to handle a message type: Type '{ type: "video"; ... }' is not assignable to type 'never'
      const _exhaustive: never = message
      throw new Error(`Unsupported message type: ${(message as OutgoingMessage).type}`)
    }
  }
}

export function toSystemModelMessage(content: string): SystemModelMessage {
  return { role: 'system', content }
}
