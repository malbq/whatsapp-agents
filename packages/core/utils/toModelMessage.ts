import type { OutgoingMessage } from '@batman/whatsapp'
import type {
  AssistantModelMessage,
  LanguageModelUsage,
  SystemModelMessage,
  TextPart,
  UserModelMessage,
} from 'ai'
import type {
  AudioMessage,
  ContactMessage,
  IncomingDocumentMessage,
  IncomingImageMessage,
  IncomingMessage,
  InteractiveButtonMessage,
  InteractiveCtaUrlMessage,
  InteractiveListMessage,
  LocationMessage,
  OutgoingDocumentMessage,
  OutgoingImageMessage,
  TemplateMessage,
  TextMessage,
  VoiceMessage,
} from '../../whatsapp/types'
import { transcribeAudio } from '../ai/transcribeAudio'

//TODO how should we handle reaction messages?
export interface ToUserModelMessageResult {
  message: UserModelMessage
  usage?: LanguageModelUsage
}

export async function toUserModelMessage(
  message:
    | TextMessage
    | VoiceMessage
    | AudioMessage
    | IncomingDocumentMessage
    | IncomingImageMessage
    | LocationMessage
    | ContactMessage
): Promise<ToUserModelMessageResult> {
  switch (message.type) {
    case 'text':
      return { message: { role: 'user', content: [{ type: 'text', text: message.text }] } }
    case 'voice':
    case 'audio': {
      const transcription = await transcribeAudio({
        audio: message.data,
        mimeType: message.mimeType,
      })
      return {
        message: { role: 'user', content: [{ type: 'text', text: transcription.text }] },
        usage: transcription.usage,
      }
    }
    case 'image':
      return {
        message: {
          role: 'user',
          content: [
            {
              type: 'image',
              image: message.data,
              mediaType: message.mimeType,
            },
            ...(message.caption
              ? [{ type: 'text', text: message.caption } satisfies TextPart]
              : []),
          ],
        },
      }
    case 'document':
      return {
        message: {
          role: 'user',
          content: [
            {
              type: 'file',
              data: message.data,
              mediaType: message.mimeType,
              filename: message.filename,
            },
            ...(message.caption
              ? [{ type: 'text', text: message.caption } satisfies TextPart]
              : []),
          ],
        },
      }
    case 'location':
      return {
        message: {
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
        },
      }
    case 'contact':
      return {
        message: {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `<contact>${message.name ? `\n<name>${message.name}</name>` : ''}\n<phone>${
                message.phone
              }</phone>\n</contact>`,
            } satisfies TextPart,
          ],
        },
      }
    default: {
      // Prevent forgetting to handle a message type: Type '{ type: "video"; ... }' is not assignable to type 'never'
      const _exhaustive: never = message
      throw new Error(`Unsupported message type: ${(message as IncomingMessage).type}`)
    }
  }
}

export function toAssistantModelMessage(
  message:
    | TextMessage
    | OutgoingDocumentMessage
    | OutgoingImageMessage
    | LocationMessage
    | ContactMessage
    | InteractiveListMessage
    | InteractiveButtonMessage
    | InteractiveCtaUrlMessage
    | TemplateMessage
): AssistantModelMessage {
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
