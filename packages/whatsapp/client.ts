import { createHash } from 'node:crypto'
import {
  FailedToDownloadMediaError,
  MediaHashMismatchError,
  ResponseDeliveryError,
} from './errors'
import { getExtFromMimeType } from './utils'
import type { Chat, Notification, StatusUpdate } from './types'
import type {
  WaAcknowledgeMessageResponse,
  WaMediaUrlResponse,
  WaNotification,
  WaOutgoingContact,
  WaOutgoingDocument,
  WaOutgoingImage,
  WaOutgoingInteractiveButton,
  WaOutgoingInteractiveCtaUrl,
  WaOutgoingInteractiveList,
  WaOutgoingLocation,
  WaOutgoingMessageResponse,
  WaOutgoingMessageUnion,
  WaOutgoingReaction,
  WaOutgoingTemplate,
  WaOutgoingText,
  WaTemplateComponent,
} from './whatsappTypes'

export interface WhatsappConfig {
  apiToken: string
  businessPhoneId: string
}

const WA_API_VERSION = import.meta.env.WA_API_VERSION || 'v23.0'

export function createWhatsappClient(config: WhatsappConfig): Chat {
  const authorizationHeader = `Bearer ${config.apiToken}`

  async function fetchReceivedMedia(mediaId: string, sha256: string): Promise<ArrayBuffer> {
    const init: RequestInit = {
      headers: {
        Authorization: authorizationHeader,
      },
    }
    const urlData = (await fetch(
      `https://graph.facebook.com/${WA_API_VERSION}/${mediaId}/`,
      init
    ).then((response) => response.json())) as WaMediaUrlResponse
    console.debug(`Media URL: ${urlData.url}`)

    const mediaResponse = await fetch(urlData.url, init)

    if (!mediaResponse.body) {
      console.error('Failed to download media from {url}: {status} {statusText}', {
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
      console.error('Media SHA256 mismatch', {
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
      `https://graph.facebook.com/${WA_API_VERSION}/${config.businessPhoneId}/media`,
      {
        method: 'POST',
        headers: {
          Authorization: authorizationHeader,
        },
        body: formData,
      }
    )

    if (!uploadResponse.ok) {
      const body = await uploadResponse.text()
      console.error(
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

  async function sendMessageRequest<T extends WaOutgoingMessageUnion>(
    requestBody: T
  ): Promise<string> {
    const httpResponse = await fetch(
      `https://graph.facebook.com/${WA_API_VERSION}/${config.businessPhoneId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: authorizationHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    )

    if (!httpResponse.ok) {
      console.error('Failed to send message: {status} {statusText}', {
        status: httpResponse.status,
        statusText: httpResponse.statusText,
        body: await httpResponse.text(),
      })
      throw new ResponseDeliveryError('Failed to send message')
    }

    const response = (await httpResponse.json()) as WaOutgoingMessageResponse

    if (!response.messages?.[0]?.id) {
      console.error('Send message request succeeded but no message ID was returned', {
        ...response,
      })
      throw new ResponseDeliveryError('Failed to send message')
    }

    return response.messages[0].id
  }

  return {
    parseNotification: async (body) => {
      const change = (body as WaNotification).entry?.[0]?.changes?.[0]
      if (!change) return null

      const contact = change.value.contacts?.[0]
      if (!contact) return null

      const notification: Notification = {
        userExternalId: contact.wa_id,
        userName: contact.profile.name,
      }

      const statusUpdate = change.value.statuses?.[0]
      if (statusUpdate) {
        return {
          ...notification,
          statusUpdate: statusUpdate.status as StatusUpdate,
        }
      }

      const waMessage = change.value.messages?.[0]
      if (!waMessage) return null

      switch (waMessage.type) {
        case 'text':
          return {
            ...notification,
            message: {
              waId: waMessage.id,
              type: 'text',
              text: waMessage.text.body,
            },
          }
        case 'audio':
          return {
            ...notification,
            message: {
              waId: waMessage.id,
              type: waMessage.audio.voice ? 'voice' : 'audio',
              data: await fetchReceivedMedia(waMessage.audio.id, waMessage.audio.sha256),
              mimeType: waMessage.audio.mime_type,
            },
          }
        case 'document':
          return {
            ...notification,
            message: {
              waId: waMessage.id,
              type: 'document',
              caption: waMessage.document.caption,
              filename: waMessage.document.filename,
              data: await fetchReceivedMedia(waMessage.document.id, waMessage.document.sha256),
              mimeType: waMessage.document.mime_type,
            },
          }
        case 'image':
          return {
            ...notification,
            message: {
              waId: waMessage.id,
              type: 'image',
              caption: waMessage.image.caption,
              data: await fetchReceivedMedia(waMessage.image.id, waMessage.image.sha256),
              mimeType: waMessage.image.mime_type,
            },
          }
        default:
          return {
            ...notification,
            message: {
              waId: waMessage.id,
              type: 'unsupported',
              unsupportedType: waMessage.type,
            },
          }
      }
    },

    acknowledgeMessage: async (messageId) => {
      const response = (await fetch(
        `https://graph.facebook.com/${WA_API_VERSION}/${config.businessPhoneId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: authorizationHeader,
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
        })) as WaAcknowledgeMessageResponse

      if (response.success) {
        console.log(`Message acknowledged: ${messageId}`)
        return
      }

      console.error('Failed to acknowledge message: {code} {type} {message}', {
        message: response.error?.message,
        code: response.error?.code,
        type: response.error?.type,
        details: response.error?.error_data?.details,
      })
    },

    sendText: async (userWhatsappId, { text, replyingTo }) => {
      const requestBody: WaOutgoingText = {
        messaging_product: 'whatsapp',
        to: userWhatsappId,
        type: 'text',
        text: { body: text, preview_url: true },
        ...(replyingTo && { context: { message_id: replyingTo } }),
      }

      const messageId = await sendMessageRequest(requestBody)
      console.debug(`Sent 'text' response`, { messageId })
      return messageId
    },

    sendImage: async (userWhatsappId, { data, caption, mimeType, replyingTo }) => {
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

    sendDocument: async (userWhatsappId, { data, filename, caption, mimeType, replyingTo }) => {
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

      const messageId = await sendMessageRequest(message)
      console.debug(`Sent 'document' response`, { messageId })
      return messageId
    },

    sendLocation: async (userWhatsappId, { latitude, longitude, name, address, replyingTo }) => {
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

      const messageId = await sendMessageRequest(requestBody)
      console.debug(`Sent 'location' response`, { messageId })
      return messageId
    },

    sendReaction: async (userWhatsappId, { externalChatId, emoji }) => {
      const requestBody: WaOutgoingReaction = {
        messaging_product: 'whatsapp',
        to: userWhatsappId,
        type: 'reaction',
        reaction: {
          message_id: externalChatId,
          emoji,
        },
      }

      const messageId = await sendMessageRequest(requestBody)
      console.debug(`Sent 'reaction' response`, { messageId })
      return messageId
    },

    sendContact: async (userWhatsappId, contact) => {
      const name = contact.name.trim()
      const phone = normalizePhoneNumber(contact.phone)
      if (name.length === 0 || phone.length === 0) {
        throw new ResponseDeliveryError('Name and phone are required')
      }

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

      const messageId = await sendMessageRequest(requestBody)
      console.debug(`Sent 'contacts' response`, { messageId })
      return messageId
    },

    sendInteractiveList: async (userWhatsappId, { header, body, footer, action, replyingTo }) => {
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

      const messageId = await sendMessageRequest(requestBody)
      console.debug(`Sent 'interactive list' response`, { messageId })
      return messageId
    },

    sendInteractiveButton: async (userWhatsappId, { header, body, footer, action, replyingTo }) => {
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

    sendInteractiveCtaUrl: async (userWhatsappId, { header, body, footer, action, replyingTo }) => {
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

      const messageId = await sendMessageRequest(requestBody)
      console.debug(`Sent 'interactive button' response`, { messageId })
      return messageId
    },

    sendTemplate: async (
      userWhatsappId,
      { name, language, headerParameters, bodyParameters, footerParameters }
    ) => {
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

      const messageId = await sendMessageRequest(requestBody)
      console.debug(`Sent 'template' response`, { messageId })
      return messageId
    },
  }
}

function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.trim().replace(/[\s\-()+ ]/g, '')

  if (phone.startsWith('+55') && cleaned.length === 12) {
    return cleaned.slice(0, 4) + cleaned.slice(5)
  }

  return cleaned
}
