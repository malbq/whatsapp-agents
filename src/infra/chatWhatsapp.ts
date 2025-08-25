import { getLogger } from '@logtape/logtape'
import { createHash } from 'node:crypto'
import {
  FailedToDownloadMediaError,
  MediaHashMismatchError,
  ResponseDeliveryError,
} from '../errors'
import { getContext } from '../index'
import type { Chat, IncomingMessage } from './chat'

const { META_API_TOKEN, WA_API_VERSION } = import.meta.env

const logger = getLogger(['app', 'infra', 'chat'])

function test() {}
test()

export namespace Whatsapp {
  export const chat: Chat = {
    parseNotification: async (body) => {
      const change = (body as Notification).entry?.[0]?.changes?.[0]
      if (!change) return {}

      const statusUpdate = change.value.statuses?.[0]
      if (statusUpdate) return { statusUpdate }

      const contact = change.value.contacts?.[0]
      const waMessage = change.value.messages?.[0]
      if (!contact || !waMessage) return {}

      getContext().set('businessPhoneNumberId', change.value.metadata.phone_number_id)
      getContext().set('userWhatsappId', contact.wa_id)

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
      const businessPhoneNumberId = getContext().var.businessPhoneNumberId

      if (!businessPhoneNumberId) {
        logger.error`Business phone number ID not found`
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
        logger.info`Message acknowledged: ${messageId}`
        return
      }

      logger.error('Failed to acknowledge message: {code} {type} {message}', {
        message: response.error?.message,
        code: response.error?.code,
        type: response.error?.type,
        details: response.error?.error_data?.details,
      })
    },

    sendTextMessage: async ({ text, replyingTo: replyToMessage }) => {
      const businessPhoneNumberId = getContext().var.businessPhoneNumberId
      const userWhatsappId = getContext().var.userWhatsappId

      if (!businessPhoneNumberId || !userWhatsappId) {
        throw new ResponseDeliveryError('Business number or user WhatsApp ID not found')
      }

      const requestBody: OutgoingTextMessage = {
        messaging_product: 'whatsapp',
        to: userWhatsappId,
        text: { body: text },
        ...(replyToMessage && { context: { message_id: replyToMessage } }),
      }

      const httpResponse = await fetch(
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

      if (!httpResponse.ok) {
        logger.error('Failed to send message: {status} {statusText}', {
          status: httpResponse.status,
          statusText: httpResponse.statusText,
          body: await httpResponse.text(),
        })
        throw new ResponseDeliveryError('Failed to send message')
      }

      const response = (await httpResponse.json()) as OutgoingMessageResponse

      if (!response.messages?.[0]?.id) {
        logger.error('Send message request succeeded but no message ID was returned', {
          ...response,
        })
        throw new ResponseDeliveryError('Failed to send message')
      }

      return response.messages[0].id
    },
    sendImageMessage: async ({ data, caption, replyingTo: replyToMessage }) => {
      const businessPhoneNumberId = getContext().get('businessPhoneNumberId')
      const to = getContext().get('userWhatsappId')

      if (!businessPhoneNumberId || !to) {
        logger.error('Missing context for sending image message')
        throw new ResponseDeliveryError('Missing context for sending message')
      }

      // First upload the image to Facebook
      const formData = new FormData()
      formData.append('file', new Blob([data]), 'image.jpg')
      formData.append('type', 'image/jpeg')
      formData.append('messaging_product', 'whatsapp')

      const uploadResponse = await fetch(
        `https://graph.facebook.com/${WA_API_VERSION}/${businessPhoneNumberId}/media`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${META_API_TOKEN}`,
          },
          body: formData,
        }
      )

      if (!uploadResponse.ok) {
        logger.error('Failed to upload image: {status} {statusText}', {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          body: await uploadResponse.text(),
        })
        throw new ResponseDeliveryError('Failed to upload image')
      }

      const uploadResult = (await uploadResponse.json()) as { id: string }
      const mediaId = uploadResult.id

      // Now send the image message
      const message = {
        messaging_product: 'whatsapp' as const,
        to,
        type: 'image',
        image: {
          id: mediaId,
          caption: caption || undefined,
        },
        ...(replyToMessage && { context: { message_id: replyToMessage } }),
      }

      const response = await fetch(
        `https://graph.facebook.com/${WA_API_VERSION}/${businessPhoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${META_API_TOKEN}`,
          },
          body: JSON.stringify(message),
        }
      )

      logger.debug('Image message API response {status}', { status: response.status })

      if (!response.ok) {
        logger.error('Failed to send image message: {status} {statusText}', {
          status: response.status,
          statusText: response.statusText,
          body: await response.text(),
        })
        throw new ResponseDeliveryError('Failed to send image message')
      }

      const messageResponse = (await response.json()) as OutgoingMessageResponse
      if (!messageResponse.messages?.[0]?.id) {
        logger.error('Send image message request succeeded but no message ID was returned', {
          response: messageResponse,
        })
        throw new ResponseDeliveryError('Failed to send image message')
      }

      return messageResponse.messages[0].id
    },

    sendDocumentMessage: async ({ data, filename, caption, replyingTo: replyToMessage }) => {
      const businessPhoneNumberId = getContext().get('businessPhoneNumberId')
      const to = getContext().get('userWhatsappId')

      if (!businessPhoneNumberId || !to) {
        logger.error('Missing context for sending document message')
        throw new ResponseDeliveryError('Missing context for sending message')
      }

      // First upload the document to Facebook
      const formData = new FormData()
      formData.append('file', new Blob([data]), filename)
      formData.append('type', 'application/octet-stream')
      formData.append('messaging_product', 'whatsapp')

      const uploadResponse = await fetch(
        `https://graph.facebook.com/${WA_API_VERSION}/${businessPhoneNumberId}/media`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${META_API_TOKEN}`,
          },
          body: formData,
        }
      )

      if (!uploadResponse.ok) {
        logger.error('Failed to upload document: {status} {statusText}', {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          body: await uploadResponse.text(),
        })
        throw new ResponseDeliveryError('Failed to upload document')
      }

      const uploadResult = (await uploadResponse.json()) as { id: string }
      const mediaId = uploadResult.id

      // Now send the document message
      const message = {
        messaging_product: 'whatsapp' as const,
        to,
        type: 'document',
        document: {
          id: mediaId,
          filename,
          caption: caption || undefined,
        },
        ...(replyToMessage && { context: { message_id: replyToMessage } }),
      }

      const response = await fetch(
        `https://graph.facebook.com/${WA_API_VERSION}/${businessPhoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${META_API_TOKEN}`,
          },
          body: JSON.stringify(message),
        }
      )

      logger.debug('Document message API response {status}', { status: response.status })

      if (!response.ok) {
        logger.error('Failed to send document message: {status} {statusText}', {
          status: response.status,
          statusText: response.statusText,
          body: await response.text(),
        })
        throw new ResponseDeliveryError('Failed to send document message')
      }

      const messageResponse = (await response.json()) as OutgoingMessageResponse
      if (!messageResponse.messages?.[0]?.id) {
        logger.error('Send document message request succeeded but no message ID was returned', {
          response: messageResponse,
        })
        throw new ResponseDeliveryError('Failed to send document message')
      }

      return messageResponse.messages[0].id
    },
  }

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
    logger.info`Media URL: ${urlData.url}`

    const mediaResponse = await fetch(urlData.url, init)

    if (!mediaResponse.body) {
      logger.error('Failed to download media from {url}: {status} {statusText}', {
        url: urlData.url,
        status: mediaResponse.status,
        statusText: mediaResponse.statusText,
        body: await mediaResponse.text(),
      })
      throw new FailedToDownloadMediaError('Failed to download media')
    }

    const media = await mediaResponse.arrayBuffer()
    const computed = createHash('sha256').update(new Uint8Array(media)).digest('base64')
    if (computed !== sha256) {
      logger.error('Media SHA256 mismatch', {
        received: sha256,
        computed,
      })
      throw new MediaHashMismatchError('Media SHA256 mismatch')
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
