import chalk from 'chalk'
import { createHash } from 'node:crypto'
import { FailedToDownloadMediaError, MediaHashMismatchError } from '../errors'
import type { Store } from '../index'
import type { Chat, IncomingMessage } from './chat'

const { META_API_TOKEN, WA_API_VERSION } = process.env

export namespace Whatsapp {
  export const chat = (store: Store): Chat => ({
    parseNotification: async (body) => {
      if (!store.getStore()) {
        throw new Error('Store not found')
      }

      const change = (body as Notification).entry?.[0]?.changes?.[0]
      if (!change) return {}

      const statusUpdate = change.value.statuses?.[0]
      if (statusUpdate) return { statusUpdate }

      const contact = change.value.contacts?.[0]
      const waMessage = change.value.messages?.[0]
      if (!contact || !waMessage) return {}

      store.getStore()?.set('businessPhoneNumberId', change.value.metadata.phone_number_id)
      store.getStore()?.set('userWhatsappId', contact.wa_id)

      const message: Pick<IncomingMessage, 'userExternalId' | 'userName' | 'externalId'> = {
        userExternalId: contact.wa_id,
        userName: contact.profile.name,
        externalId: waMessage.id,
      }
      switch (waMessage.type) {
        case 'text':
          return {
            message: {
              ...message,
              type: 'text',
              text: waMessage.text.body,
            },
          }
        case 'audio':
          return {
            message: {
              ...message,
              type: waMessage.audio.voice ? 'voice' : 'audio',
              mediaData: await fetchReceivedMedia(waMessage.audio.id, waMessage.audio.sha256),
              mimeType: waMessage.audio.mime_type,
            },
          }
        case 'document':
          return {
            message: {
              ...message,
              type: 'document',
              documentFilename: waMessage.document.filename,
              mediaData: await fetchReceivedMedia(waMessage.document.id, waMessage.document.sha256),
              mimeType: waMessage.document.mime_type,
            },
          }
        case 'image':
          return {
            message: {
              ...message,
              type: 'image',
              text: waMessage.image.caption,
              mediaData: await fetchReceivedMedia(waMessage.image.id, waMessage.image.sha256),
              mimeType: waMessage.image.mime_type,
            },
          }
        default:
          return {
            message: {
              ...message,
              type: 'unsupported',
              unsupportedType: waMessage.type,
            },
          }
      }
    },

    acknowledgeProcessingMessage: async (messageId) => {
      const businessPhoneNumberId = store.getStore()?.get('businessPhoneNumberId')

      if (!businessPhoneNumberId) {
        console.error('Business phone number ID not found')
        return
      }

      const response = (await fetch(
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
        .then((response) => response.json())
        .catch((error) => {
          return {
            success: false,
            error: {
              message: error.message,
              code: error.code,
            },
          }
        })) as AcknowledgeMessageResponse

      if (response.success) {
        console.debug(chalk.gray('Message acknowledged', messageId))
        return
      }

      console.error(`Failed to acknowledge message ${messageId}`)
      response.error?.message && console.error(response.error?.message)
      response.error?.code && console.error(response.error?.code)
      response.error?.type && console.error(response.error?.type)
      response.error?.error_data?.details && console.error(response.error?.error_data?.details)
    },

    sendTextMessage: async ({ text, replyingTo: replyToMessage }) => {
      const businessPhoneNumberId = store.getStore()?.get('businessPhoneNumberId')
      const userWhatsappId = store.getStore()?.get('userWhatsappId')

      if (!businessPhoneNumberId || !userWhatsappId) {
        throw new Error('Business number or user WhatsApp ID not found')
      }

      const requestBody: OutgoingTextMessage = {
        messaging_product: 'whatsapp',
        to: userWhatsappId,
        text: { body: text },
      }

      if (replyToMessage) {
        requestBody.context = {
          message_id: replyToMessage,
        }
      }

      const response = (await fetch(
        `https://graph.facebook.com/${WA_API_VERSION}/${businessPhoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${META_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      ).then((response) => response.json())) as OutgoingMessageResponse
      if (!response.messages?.[0]?.id) {
        throw new Error('Failed to send message')
      }
      return response.messages[0].id
    },
  })

  async function fetchReceivedMedia(mediaId: string, sha256: string) {
    const init: RequestInit = {
      headers: {
        Authorization: `Bearer ${META_API_TOKEN}`,
      },
    }
    const urlData = (await fetch(
      `https://graph.facebook.com/${WA_API_VERSION}/${mediaId}/`,
      init
    ).then((response) => response.json())) as MediaUrlResponse
    console.debug(chalk.gray('Download media response:', JSON.stringify(urlData)))

    const mediaResponse = await fetch(urlData.url, init)

    if (!mediaResponse.body) {
      console.error(
        `Failed to download media\nURL: ${urlData.url}\nStatus: ${mediaResponse.status}\nStatus Text: ${mediaResponse.statusText}`
      )
      throw new FailedToDownloadMediaError()
    }

    const media = await mediaResponse.arrayBuffer()
    const computed = createHash('sha256').update(new Uint8Array(media)).digest('base64')
    if (computed !== sha256) {
      console.error(`Media SHA256 mismatch\nreceived: ${sha256}\ncomputed: ${computed}`)
      throw new MediaHashMismatchError()
    }
    return media
  }

  export type AcknowledgeMessageResponse = {
    success?: boolean
    error?: {
      message: string
      code: number
      type?: string
      error_data?: {
        messaging_product: string
        details: string
      }
      fbtrace_id?: string
    }
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

  export type OutgoingMessageResponse = {
    messaging_product: 'whatsapp'
    contacts?: Array<{
      input: string
      wa_id: string
    }>
    messages?: Array<{
      id: string
      message_status: string
    }>
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
