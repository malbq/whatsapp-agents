import { createHash } from 'node:crypto'
import { FailedToDownloadMediaError, MediaHashMismatchError, ResponseDeliveryError } from './errors'
import type {
  Chat,
  Notification,
  StatusUpdate,
  StatusUpdateNotification,
  TemplateParameters,
} from './types'
import { getExtFromMimeType } from './utils'
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
  WaTemplateTextParameter,
} from './whatsappTypes'

export interface WhatsappConfig {
  apiToken: string
  businessPhoneId: string
}

const WA_API_VERSION = import.meta.env.WA_API_VERSION || 'v23.0'
const MAX_OPTIONS_PER_SECTION = 10

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
      console.error(`Failed to send message: ${httpResponse.status} ${httpResponse.statusText}`, {
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
    const messageId = response.messages[0].id
    console.debug(
      `Sent "${requestBody.type}${
        requestBody.type === 'interactive' ? `-${requestBody.interactive.type}` : ''
      }" response`,
      { messageId }
    )
    return messageId
  }

  return {
    parseNotification: async (body) => {
      const change = (body as WaNotification).entry?.[0]?.changes?.[0]?.value
      if (!change) return null

      const contact = change.contacts?.[0]
      if (!contact) return null

      const notification: Notification = {
        userId: contact.wa_id,
        userName: contact.profile.name,
      }

      const statusUpdate = change.statuses?.[0]
      if (statusUpdate) {
        return {
          ...notification,
          statusUpdate: statusUpdate.status as StatusUpdate,
        } satisfies StatusUpdateNotification
      }

      const waMessage = change.messages?.[0]
      if (!waMessage) return null

      switch (waMessage.type) {
        case 'text':
          return {
            ...notification,
            message: {
              messageId: waMessage.id,
              type: 'text',
              text: waMessage.text.body,
            },
          }
        case 'audio':
          return {
            ...notification,
            message: {
              messageId: waMessage.id,
              type: waMessage.audio.voice ? 'voice' : 'audio',
              data: await fetchReceivedMedia(waMessage.audio.id, waMessage.audio.sha256),
              mimeType: waMessage.audio.mime_type,
            },
          }
        case 'document':
          return {
            ...notification,
            message: {
              messageId: waMessage.id,
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
              messageId: waMessage.id,
              type: 'image',
              caption: waMessage.image.caption,
              data: await fetchReceivedMedia(waMessage.image.id, waMessage.image.sha256),
              mimeType: waMessage.image.mime_type,
            },
          }
        case 'button':
          return {
            ...notification,
            message: {
              messageId: waMessage.id,
              type: 'text',
              text: waMessage.button.text,
            },
          }
        default:
          return {
            ...notification,
            message: {
              messageId: waMessage.id,
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
            message_id: messageId,
            status: 'read',
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

      console.error(
        `Failed to acknowledge message: ${response.error?.code} ${response.error?.type} ${response.error?.message}`,
        response.error?.error_data?.details
      )
    },

    sendTypingIndicator: async (messageId) => {
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
            message_id: messageId,
            status: 'read',
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
        console.log(`Typing indicator sent: ${messageId}`)
        return
      }

      console.error(
        `Failed to send typing indicator: ${response.error?.code} ${response.error?.type} ${response.error?.message}`,
        response.error?.error_data?.details
      )
    },

    sendText: async (userId, { text, replyingTo }) => {
      const requestBody: WaOutgoingText = {
        messaging_product: 'whatsapp',
        to: userId,
        type: 'text',
        text: { body: text, preview_url: true },
        ...(replyingTo && { context: { message_id: replyingTo } }),
      }

      return await sendMessageRequest(requestBody)
    },

    sendImage: async (userId, { data, caption, mimeType, replyingTo }) => {
      const mediaId = await uploadMedia(data, mimeType)

      const message: WaOutgoingImage = {
        messaging_product: 'whatsapp',
        to: userId,
        type: 'image',
        image: {
          id: mediaId,
          caption: caption || undefined,
        },
        ...(replyingTo && { context: { message_id: replyingTo } }),
      }
      return await sendMessageRequest(message)
    },

    sendDocument: async (userId, { data, filename, caption, mimeType, replyingTo }) => {
      const mediaId = await uploadMedia(data, mimeType, filename)

      const message: WaOutgoingDocument = {
        messaging_product: 'whatsapp',
        to: userId,
        type: 'document',
        document: {
          id: mediaId,
          filename: filename ?? `file.${getExtFromMimeType(mimeType)}`,
          caption: caption || undefined,
        },
        ...(replyingTo && { context: { message_id: replyingTo } }),
      }

      return await sendMessageRequest(message)
    },

    sendLocation: async (userId, { latitude, longitude, name, address, replyingTo }) => {
      const requestBody: WaOutgoingLocation = {
        messaging_product: 'whatsapp',
        to: userId,
        type: 'location',
        location: {
          latitude,
          longitude,
          name,
          address,
        },
        ...(replyingTo && { context: { message_id: replyingTo } }),
      }

      return await sendMessageRequest(requestBody)
    },

    sendReaction: async (userId, { targetMessageId, emoji }) => {
      const requestBody: WaOutgoingReaction = {
        messaging_product: 'whatsapp',
        to: userId,
        type: 'reaction',
        reaction: {
          message_id: targetMessageId,
          emoji,
        },
      }

      return await sendMessageRequest(requestBody)
    },

    sendContact: async (userId, contact) => {
      const name = contact.name.trim()
      const phone = normalizePhoneNumber(contact.phone)
      if (name.length === 0 || phone.length === 0) {
        throw new ResponseDeliveryError('Name and phone are required')
      }

      const requestBody: WaOutgoingContact = {
        messaging_product: 'whatsapp',
        to: userId,
        type: 'contacts',
        contacts: [
          {
            name: { formatted_name: name, first_name: name.split(' ')[0]! },
            phones: [{ phone: phone, wa_id: phone }],
          },
        ],
      }

      return await sendMessageRequest(requestBody)
    },

    sendInteractiveList: async (
      userId,
      { header, body, footer, openListButton, sections, replyingTo }
    ) => {
      const $sections: WaOutgoingInteractiveList['interactive']['action']['sections'] = []
      let used = 0
      for (const section of sections) {
        if (used >= MAX_OPTIONS_PER_SECTION) break
        const remaining = MAX_OPTIONS_PER_SECTION - used
        const rows: Array<{ id: string; title: string; description?: string }> = []
        for (const option of section.options) {
          if (rows.length >= remaining) break
          rows.push({
            id: option.title,
            title: option.title.slice(0, 24),
            description: option.description?.slice(0, 72),
          })
        }
        if (rows.length === 0) continue
        $sections.push({
          title: section.title?.slice(0, 24),
          rows,
        })
        used += rows.length
      }
      const requestBody: WaOutgoingInteractiveList = {
        messaging_product: 'whatsapp',
        to: userId,
        type: 'interactive',
        interactive: {
          type: 'list',
          header: header ? { type: 'text', text: header.slice(0, 60) } : undefined,
          body: { text: body.slice(0, 4096) },
          footer: footer ? { text: footer.slice(0, 60) } : undefined,
          action: {
            button: openListButton.slice(0, 20),
            sections: $sections,
          },
        },
        ...(replyingTo && { context: { message_id: replyingTo } }),
      }
      return await sendMessageRequest(requestBody)
    },

    sendInteractiveButton: async (userId, { header, body, footer, buttons, replyingTo }) => {
      const requestBody: WaOutgoingInteractiveButton = {
        messaging_product: 'whatsapp',
        to: userId,
        type: 'interactive',
        interactive: {
          type: 'button',
          header: header ? { type: 'text', text: header.slice(0, 60) } : undefined,
          body: { text: body.slice(0, 1024) },
          footer: footer ? { text: footer.slice(0, 60) } : undefined,
          action: {
            buttons: buttons.map((button) => ({
              type: 'reply',
              reply: {
                id: button,
                title: button.slice(0, 20),
              },
            })),
          },
        },
        ...(replyingTo && { context: { message_id: replyingTo } }),
      }
      return await sendMessageRequest(requestBody)
    },

    sendInteractiveCtaUrl: async (userId, { header, body, footer, action, replyingTo }) => {
      const requestBody: WaOutgoingInteractiveCtaUrl = {
        messaging_product: 'whatsapp',
        to: userId,
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          header: header ? { type: 'text', text: header.slice(0, 60) } : undefined,
          body: { text: body.slice(0, 1024) },
          footer: footer ? { text: footer.slice(0, 60) } : undefined,
          action: {
            name: 'cta_url',
            parameters: {
              display_text: action.text.slice(0, 20),
              url: action.url,
            },
          },
        },
        ...(replyingTo && { context: { message_id: replyingTo } }),
      }

      return await sendMessageRequest(requestBody)
    },

    sendTemplate: async (
      userId,
      { name, language, headerParameters, bodyParameters, footerParameters }
    ) => {
      const components: Array<WaTemplateComponent> = []
      if (headerParameters) {
        components.push({
          type: 'header',
          parameters: convertParameters(headerParameters),
        })
      }
      if (bodyParameters) {
        components.push({
          type: 'body',
          parameters: convertParameters(bodyParameters),
        })
      }
      if (footerParameters) {
        components.push({
          type: 'footer',
          parameters: convertParameters(footerParameters),
        })
      }
      const requestBody: WaOutgoingTemplate = {
        messaging_product: 'whatsapp',
        to: userId,
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

      return await sendMessageRequest(requestBody)
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

function convertParameters(params: TemplateParameters): Array<WaTemplateTextParameter> {
  if (Array.isArray(params)) {
    return params.map((parameter) => ({ type: 'text', text: parameter }))
  }
  return Object.entries(params).map(([key, value]) => ({
    type: 'text',
    parameter_name: key,
    text: value,
  }))
}
