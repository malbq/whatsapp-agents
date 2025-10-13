import { getLogger } from '@logtape/logtape'
import { createHash } from 'node:crypto'
import { getContext } from '../context'
import {
  FailedToDownloadMediaError,
  MediaHashMismatchError,
  ResponseDeliveryError,
} from '../errors'
import { getExtFromMimeType } from '../utils/getExtFromMimeType'
import type { Chat, IncomingMessage } from './chat'

const { META_API_TOKEN, WA_API_VERSION, WA_BUSINESS_PHONE_ID } = import.meta.env
const AuthorizationHeader = `Bearer ${META_API_TOKEN}`

const logger = getLogger(['infra', 'chat'])

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
              text: waMessage.document.caption,
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

    acknowledgeMessage: async (messageId) => {
      const response = (await fetch(
        `https://graph.facebook.com/${WA_API_VERSION}/${WA_BUSINESS_PHONE_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: AuthorizationHeader,
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
        logger.info(`Message acknowledged: ${messageId}`)
        return
      }

      logger.error('Failed to acknowledge message: {code} {type} {message}', {
        message: response.error?.message,
        code: response.error?.code,
        type: response.error?.type,
        details: response.error?.error_data?.details,
      })
    },

    sendText: async ({ text, replyingTo }) => {
      const { userWhatsappId } = getUserWaId()

      const requestBody: WaOutgoingText = {
        messaging_product: 'whatsapp',
        to: userWhatsappId,
        type: 'text',
        text: { body: text, preview_url: true },
        ...(replyingTo && { context: { message_id: replyingTo } }),
      }

      return sendMessageRequest(requestBody)
    },

    sendImage: async ({ data, caption, mimeType, replyingTo }) => {
      const { userWhatsappId } = getUserWaId()

      const mediaId = await uploadMedia(data, mimeType)

      const message: WaOutgoingImage = {
        messaging_product: 'whatsapp',
        to: userWhatsappId,
        type: 'image',
        image: {
          id: mediaId,
          caption: caption || undefined,
        },
        ...(replyingTo && { context: { message_id: replyingTo } }),
      }

      return sendMessageRequest(message)
    },

    sendDocument: async ({ data, filename, caption, mimeType, replyingTo }) => {
      const { userWhatsappId } = getUserWaId()

      const mediaId = await uploadMedia(data, mimeType, filename)

      const message: WaOutgoingDocument = {
        messaging_product: 'whatsapp',
        to: userWhatsappId,
        type: 'document',
        document: {
          id: mediaId,
          filename: filename ?? `file.${getExtFromMimeType(mimeType)}`,
          caption: caption || undefined,
        },
        ...(replyingTo && { context: { message_id: replyingTo } }),
      }

      return sendMessageRequest(message)
    },

    sendLocation: async ({ latitude, longitude, name, address, replyingTo }) => {
      const { userWhatsappId } = getUserWaId()

      const requestBody: WaOutgoingLocation = {
        messaging_product: 'whatsapp',
        to: userWhatsappId,
        type: 'location',
        location: {
          latitude,
          longitude,
          name,
          address,
        },
        ...(replyingTo && { context: { message_id: replyingTo } }),
      }

      return sendMessageRequest(requestBody)
    },

    sendReaction: async ({ externalChatId, emoji }) => {
      const { userWhatsappId } = getUserWaId()

      const requestBody: WaOutgoingReaction = {
        messaging_product: 'whatsapp',
        to: userWhatsappId,
        type: 'reaction',
        reaction: {
          message_id: externalChatId,
          emoji,
        },
      }

      return sendMessageRequest(requestBody)
    },

    sendContact: async (contact) => {
      const name = contact.name.trim()
      const phone = contact.phone.trim()
      if (name.length === 0 || phone.length === 0) {
        throw new ResponseDeliveryError('Name and phone are required')
      }

      const { userWhatsappId } = getUserWaId()

      const requestBody: WaOutgoingContact = {
        messaging_product: 'whatsapp',
        to: userWhatsappId,
        type: 'contacts',
        contacts: [
          {
            name: { formatted_name: name, first_name: name.split(' ')[0]! },
            phones: [{ phone: phone, wa_id: phone }],
          },
        ],
      }

      return sendMessageRequest(requestBody)
    },

    sendInteractiveList: async ({ header, body, footer, action, replyingTo }) => {
      const { userWhatsappId } = getUserWaId()

      const requestBody: WaOutgoingInteractiveList = {
        messaging_product: 'whatsapp',
        to: userWhatsappId,
        type: 'interactive',
        interactive: {
          type: 'list',
          ...(header && { header }),
          body,
          ...(footer && { footer }),
          action,
        },
        ...(replyingTo && { context: { message_id: replyingTo } }),
      }

      return sendMessageRequest(requestBody)
    },

    sendInteractiveButton: async ({ header, body, footer, action, replyingTo }) => {
      const { userWhatsappId } = getUserWaId()

      const requestBody: WaOutgoingInteractiveButton = {
        messaging_product: 'whatsapp',
        to: userWhatsappId,
        type: 'interactive',
        interactive: {
          type: 'button',
          ...(header && { header }),
          body,
          ...(footer && { footer }),
          action,
        },
        ...(replyingTo && { context: { message_id: replyingTo } }),
      }

      return sendMessageRequest(requestBody)
    },

    sendInteractiveCtaUrl: async ({ header, body, footer, action, replyingTo }) => {
      const { userWhatsappId } = getUserWaId()

      const requestBody: WaOutgoingInteractiveCtaUrl = {
        messaging_product: 'whatsapp',
        to: userWhatsappId,
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          ...(header && { header }),
          body,
          ...(footer && { footer }),
          action,
        },
        ...(replyingTo && { context: { message_id: replyingTo } }),
      }

      return sendMessageRequest(requestBody)
    },
    sendTemplate: async ({
      name,
      language,
      headerParameters,
      bodyParameters,
      footerParameters,
    }) => {
      const { userWhatsappId } = getUserWaId()

      const components: Array<WaTemplateComponent> = []
      if (headerParameters) {
        components.push({
          type: 'header',
          parameters: headerParameters.map((parameter) => ({ type: 'text', text: parameter })),
        })
      }
      if (bodyParameters) {
        components.push({
          type: 'body',
          parameters: bodyParameters.map((parameter) => ({ type: 'text', text: parameter })),
        })
      }
      if (footerParameters) {
        components.push({
          type: 'footer',
          parameters: footerParameters.map((parameter) => ({ type: 'text', text: parameter })),
        })
      }
      const requestBody: WaOutgoingTemplate = {
        messaging_product: 'whatsapp',
        to: userWhatsappId,
        type: 'template',
        template: {
          name,
          language: {
            policy: 'deterministic',
            code: language,
          },
          components,
        },
      }

      return sendMessageRequest(requestBody)
    },
  }

  async function fetchReceivedMedia(mediaId: string, sha256: string) {
    const init: RequestInit = {
      headers: {
        Authorization: AuthorizationHeader,
      },
    }
    const urlData = (await fetch(
      `https://graph.facebook.com/${WA_API_VERSION}/${mediaId}/`,
      init
    ).then((response) => response.json())) as MediaUrlResponse
    logger.debug(`Media URL: ${urlData.url}`)

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

  async function uploadMedia(
    data: ArrayBuffer,
    mimeType: string,
    filename?: string
  ): Promise<string> {
    const formData = new FormData()
    const blobFilename = filename || `media.${getExtFromMimeType(mimeType)}`
    formData.append('file', new Blob([data], { type: mimeType }), blobFilename)
    formData.append('type', mimeType)
    formData.append('messaging_product', 'whatsapp')

    const uploadResponse = await fetch(
      `https://graph.facebook.com/${WA_API_VERSION}/${WA_BUSINESS_PHONE_ID}/media`,
      {
        method: 'POST',
        headers: {
          Authorization: AuthorizationHeader,
        },
        body: formData,
      }
    )

    if (!uploadResponse.ok) {
      const body = await uploadResponse.text()
      logger.error(
        `Failed to upload media: [${uploadResponse.status} ${uploadResponse.statusText}] ${body}`,
        {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          body,
          mimeType,
        }
      )
      throw new ResponseDeliveryError('Failed to upload media')
    }

    const uploadResult = (await uploadResponse.json()) as { id: string }
    return uploadResult.id
  }

  async function sendMessageRequest<T extends Whatsapp.WaOutgoingMessageUnion>(requestBody: T) {
    const httpResponse = await fetch(
      `https://graph.facebook.com/${WA_API_VERSION}/${WA_BUSINESS_PHONE_ID}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: AuthorizationHeader,
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
  }

  function getUserWaId() {
    const userWhatsappId = getContext().var.userWhatsappId

    if (!userWhatsappId) {
      throw new ResponseDeliveryError('User WhatsApp ID not found')
    }
    return { userWhatsappId }
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
      caption?: string
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

  export interface WaOutgoingMessage {
    messaging_product: 'whatsapp'
    to: string
    context?: { message_id: string }
  }

  export interface WaOutgoingText extends WaOutgoingMessage {
    type: 'text'
    text: { body: string; preview_url: true }
  }

  export interface WaOutgoingImage extends WaOutgoingMessage {
    type: 'image'
    image: {
      id: string
      caption?: string
    }
  }

  export interface WaOutgoingDocument extends WaOutgoingMessage {
    type: 'document'
    document: {
      id: string
      filename: string
      caption?: string
    }
  }

  export interface WaOutgoingLocation extends WaOutgoingMessage {
    type: 'location'
    location: {
      latitude: number
      longitude: number
      name?: string
      address?: string
    }
  }

  export interface WaOutgoingReaction extends WaOutgoingMessage {
    type: 'reaction'
    reaction: {
      message_id: string
      emoji: string
    }
  }

  export interface WaOutgoingContact extends WaOutgoingMessage {
    type: 'contacts'
    contacts: Array<{
      name: {
        formatted_name: string
        first_name: string
      }
      phones: Array<{
        phone: string
        wa_id: string
      }>
    }>
  }

  export interface WaOutgoingInteractiveList extends WaOutgoingMessage {
    type: 'interactive'
    interactive: {
      type: 'list'
      header?: {
        type: 'text'
        text: string
      }
      body: {
        text: string
      }
      footer?: {
        text: string
      }
      action: {
        button: string
        sections: Array<{
          title: string
          rows: Array<{
            id: string
            title: string
            description?: string
          }>
        }>
      }
    }
  }

  export interface WaOutgoingInteractiveButton extends WaOutgoingMessage {
    type: 'interactive'
    interactive: {
      type: 'button'
      header?:
        | {
            type: 'text'
            text: string
          }
        | {
            type: 'image'
            image: {
              id?: string
              link?: string
            }
          }
        | {
            type: 'document'
            document: {
              id?: string
              link?: string
              filename?: string
            }
          }
        | {
            type: 'video'
            video: {
              id?: string
              link?: string
            }
          }
      body: {
        text: string
      }
      footer?: {
        text: string
      }
      action: {
        buttons: Array<{
          type: 'reply'
          reply: {
            id: string
            title: string
          }
        }>
      }
    }
  }

  export interface WaOutgoingInteractiveCtaUrl extends WaOutgoingMessage {
    type: 'interactive'
    interactive: {
      type: 'cta_url'
      header?:
        | {
            type: 'text'
            text: string
          }
        | {
            type: 'image'
            image: {
              id?: string
              link?: string
            }
          }
        | {
            type: 'document'
            document: {
              id?: string
              link?: string
              filename?: string
            }
          }
        | {
            type: 'video'
            video: {
              id?: string
              link?: string
            }
          }
      body: {
        text: string
      }
      footer?: {
        text: string
      }
      action: {
        name: 'cta_url'
        parameters: {
          display_text: string
          url: string
        }
      }
    }
  }

  export interface WaOutgoingTemplate extends WaOutgoingMessage {
    type: 'template'
    template: {
      name: string
      language: {
        code: string
        policy: 'deterministic'
      }
      components: Array<WaTemplateComponent>
    }
  }

  export type WaTemplateComponent =
    | WaTemplateBodyComponent
    | WaTemplateHeaderComponent
    | WaTemplateFooterComponent

  export interface WaTemplateBodyComponent {
    type: 'body'
    parameters: Array<WaTemplateParameter>
  }

  export interface WaTemplateHeaderComponent {
    type: 'header'
    parameters: Array<WaTemplateParameter>
  }

  export interface WaTemplateFooterComponent {
    type: 'footer'
    parameters: Array<WaTemplateParameter>
  }

  export type WaTemplateParameter =
    | WaTemplateTextParameter
    | WaTemplateCurrencyParameter
    | WaTemplateDateTimeParameter

  export interface WaTemplateTextParameter {
    type: 'text'
    text: string
  }

  export interface WaTemplateCurrencyParameter {
    type: 'currency'
    currency: {
      fallback_value: string
      code: string
      amount_1000: number
    }
  }

  export interface WaTemplateDateTimeParameter {
    type: 'date_time'
    date_time:
      | {
          fallback_value: string
          day_of_week: number
          day_of_month: number
          year: number
          month: number
          hour: number
          minute: number
        }
      | {
          fallback_value: string
          timestamp: number
        }
  }

  export type WaOutgoingMessageUnion =
    | WaOutgoingText
    | WaOutgoingImage
    | WaOutgoingDocument
    | WaOutgoingLocation
    | WaOutgoingReaction
    | WaOutgoingContact
    | WaOutgoingInteractiveList
    | WaOutgoingInteractiveButton
    | WaOutgoingInteractiveCtaUrl
    | WaOutgoingTemplate

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
