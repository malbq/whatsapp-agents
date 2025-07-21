import chalk from 'chalk'
import type { MessageBase } from '../domain/message'
import type { Chat } from './chat'

const { META_API_TOKEN, WA_API_VERSION } = process.env

export namespace Whatsapp {
  export const chat: Chat = {
    parseNotification: (body) => {
      const change = (body as Notification).entry?.[0]?.changes?.[0]

      if (!change) return {}

      const contact = change.value.contacts?.[0]
      const waMessage = change.value.messages?.[0]
      const statusUpdate = change.value.statuses?.[0]

      if (statusUpdate) return { statusUpdate }

      if (!contact || !waMessage) return {}

      const chatUser = {
        externalId: contact.wa_id,
        name: contact.profile.name,
      }
      const message: Omit<MessageBase, 'type'> = {
        role: 'user',
        id: waMessage.id,
        from: waMessage.from,
        to: change.value.metadata.phone_number_id,
        timestamp: waMessage.timestamp,
      }
      switch (waMessage.type) {
        case 'text':
          return {
            chatUser,
            message: {
              ...message,
              type: 'text',
              body: waMessage.text.body,
            },
          }
        case 'audio':
          return {
            chatUser,
            message: {
              ...message,
              type: waMessage.audio.voice ? 'voice' : 'audio',
              mediaId: waMessage.audio.id,
              mimeType: waMessage.audio.mime_type,
            },
          }
        case 'document':
          return {
            chatUser,
            message: {
              ...message,
              type: 'document',
              mediaId: waMessage.document.id,
              mimeType: waMessage.document.mime_type,
              filename: waMessage.document.filename,
            },
          }
        case 'image':
          return {
            chatUser,
            message: {
              ...message,
              type: 'image',
              mediaId: waMessage.image.id,
              mimeType: waMessage.image.mime_type,
              caption: waMessage.image.caption,
            },
          }
        default:
          return {
            chatUser,
            message: {
              ...message,
              type: 'unsupported',
              unsupportedType: waMessage.type,
            },
          }
      }
    },

    acknowledgeProcessingMessage: async (businessPhoneNumberId, messageId) => {
      const response = await fetch(
        `https://graph.facebook.com/${WA_API_VERSION}/${businessPhoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${META_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
            typing_indicator: { type: 'text' },
          }),
        }
      )

      const data = (await response.json()) as {
        success?: boolean
        error?: {
          message: string
          type: string
          code: number
          error_data: {
            messaging_product: string
            details: string
          }
          fbtrace_id: string
        }
      }
      if (data.success) {
        console.debug('Message acknowledged', messageId)
        return
      }

      console.error(`Failed to acknowledge message ${messageId}
${data.error?.message}
${data.error?.code}
${data.error?.type}
${data.error?.error_data?.details}`)
    },

    sendTextMessage: async ({
      from: businessPhoneNumberId,
      to: toPhoneNumber,
      text,
      replyingTo: replyToMessage,
    }) => {
      const requestBody: OutgoingTextMessage = {
        messaging_product: 'whatsapp',
        to: toPhoneNumber,
        text: { body: text },
      }

      if (replyToMessage) {
        requestBody.context = {
          message_id: replyToMessage,
        }
      }

      const response = await fetch(
        `https://graph.facebook.com/${WA_API_VERSION}/${businessPhoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${META_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      )

      const data = await response.json()
      console.debug(chalk.gray('Text message response:', JSON.stringify(data)))
    },

    fetchReceivedMedia: async (mediaId) => {
      const init: RequestInit = {
        headers: {
          Authorization: `Bearer ${META_API_TOKEN}`,
        },
      }
      const urlResponse = await fetch(
        `https://graph.facebook.com/${WA_API_VERSION}/${mediaId}/`,
        init
      )
      const urlData = (await urlResponse.json()) as MediaUrlResponse
      console.debug(
        chalk.gray('Download media response:', JSON.stringify(urlData))
      )

      const mediaResponse = await fetch(urlData.url, init)

      if (!mediaResponse.body) {
        throw new Error('Failed to download media')
      }

      return {
        media: await mediaResponse.arrayBuffer(),
        mimeType: urlData.mime_type,
      }
    },
  }

  export type Notification = {
    object: 'whatsapp_business_account'
    entry: Array<Entry>
  }

  export type OutgoingTextMessage = {
    messaging_product: 'whatsapp'
    to: string
    text: { body: string }
    context?: { message_id: string }
  }

  export type MessagesChange = {
    field: 'messages'
    value: {
      messaging_product: 'whatsapp'
      metadata: MessagesChangeMetadata
      contacts?: Array<Contact>
      messages?: Array<
        | TextMessage
        | AudioMessage
        | DocumentMessage
        | ImageMessage
        | ReactionMessage
        | LocationMessage
        | ContactsMessage
        | StickerMessage
      >
      statuses?: Array<StatusUpdate>
    }
  }

  export type MessageType =
    | 'text'
    | 'audio'
    | 'document'
    | 'image'
    | 'reaction'
    | 'location'
    | 'contacts'
    | 'sticker'
    | 'unsupported'

  export interface WaIncomingMessage {
    type: MessageType
    id: string
    from: string
    timestamp: string
  }

  /**
   * Este caso aconteceu ao enviar uma mensagem com 2 imagens.
   * A notificação 'unsupported' foi seguida por 2 notificações de 'image',
   * como se fossem mensagens independentes.
   */
  export interface UnsupportedMessage extends WaIncomingMessage {
    type: 'unsupported'
    errors: Array<{
      code: number //131051
      title: string //'Message type unknown'
      message: string //'Message type unknown'
      error_data: {
        details: string //'Message type is currently not supported.'
      }
    }>
  }

  export interface TextMessage extends WaIncomingMessage {
    type: 'text'
    text: {
      body: string
    }
    context: {
      from: string
      id: string
    }
  }

  export type Media = {
    id: string
    mime_type: string
    sha256: string
  }

  export interface AudioMessage extends WaIncomingMessage {
    type: 'audio'
    audio: Media & {
      mime_type: 'audio/ogg; codecs=opus'
      voice: boolean
    }
  }

  export interface DocumentMessage extends WaIncomingMessage {
    type: 'document'
    document: Media & {
      mime_type: 'application/pdf'
      filename: string
    }
  }

  export interface ImageMessage extends WaIncomingMessage {
    type: 'image'
    image: Media & {
      mime_type: 'image/jpeg'
      caption?: string
    }
  }

  export interface StickerMessage extends WaIncomingMessage {
    type: 'sticker'
    sticker: Media & {
      mime_type: 'image/webp'
      animated: boolean
    }
  }

  export interface ContactsMessage extends WaIncomingMessage {
    type: 'contacts'
    contacts: Array<any>
  }

  export interface LocationMessage extends WaIncomingMessage {
    type: 'location'
    location: {
      latitude: number
      longitude: number
    }
  }

  export interface ReactionMessage extends WaIncomingMessage {
    type: 'reaction'
    reaction: {
      message_id: string
      emoji: string
    }
  }

  export type Entry = {
    id: string
    changes: Array<MessagesChange>
  }

  export type MessagesChangeMetadata = {
    display_phone_number: string
    phone_number_id: string
  }

  export type Contact = {
    wa_id: string
    profile: {
      name: string
    }
  }

  export type StatusUpdate = {
    id: string
    status: 'read' | 'delivered' | 'sent'
    timestamp: string
    recipient_id: string
    conversation: {
      id: string
      origin: {
        type: 'service'
      }
    }
    pricing: {
      billable: boolean
      pricing_model: string
      category: string
    }
  }

  export type MediaUrlResponse = {
    messaging_product: 'whatsapp'
    url: string
    mime_type: string
    sha256: string
    file_size: number
    id: string
  }
}
