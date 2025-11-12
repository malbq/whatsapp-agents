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
import { WhatsAppApi } from './whatsappTypes'

const WA_API_VERSION = import.meta.env.WA_API_VERSION || 'v23.0'
const MAX_OPTIONS_PER_SECTION = 10

export interface WhatsappConfig {
  apiToken: string
  businessPhoneId: string
}

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
    ).then((response) => response.json())) as WhatsAppApi.MediaUrlResponse
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

  async function sendMessageRequest<T extends WhatsAppApi.OutgoingMessageUnion>(
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

    const response = (await httpResponse.json()) as WhatsAppApi.OutgoingMessageResponse

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
      const waNotification = WhatsAppApi.NotificationSchema.safeParse(body)
      if (!waNotification.success) {
        console.debug('Failed to parse notification', waNotification.error)
        return null
      }

      const change = waNotification.data.entry?.[0]?.changes?.[0]?.value
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

      const textMessage = WhatsAppApi.TextMessageSchema.safeParse(waMessage)
      if (textMessage.success) {
        return {
          ...notification,
          message: {
            messageId: textMessage.data.id,
            type: 'text',
            text: textMessage.data.text.body,
          },
        }
      }

      const audioMessage = WhatsAppApi.AudioMessageSchema.safeParse(waMessage)
      if (audioMessage.success) {
        return {
          ...notification,
          message: {
            messageId: audioMessage.data.id,
            type: audioMessage.data.audio.voice ? 'voice' : 'audio',
            data: await fetchReceivedMedia(
              audioMessage.data.audio.id,
              audioMessage.data.audio.sha256
            ),
            mimeType: audioMessage.data.audio.mime_type,
          },
        }
      }

      const documentMessage = WhatsAppApi.DocumentMessageSchema.safeParse(waMessage)
      if (documentMessage.success) {
        return {
          ...notification,
          message: {
            messageId: documentMessage.data.id,
            type: 'document',
            caption: documentMessage.data.document.caption,
            filename: documentMessage.data.document.filename,
            data: await fetchReceivedMedia(
              documentMessage.data.document.id,
              documentMessage.data.document.sha256
            ),
            mimeType: documentMessage.data.document.mime_type,
          },
        }
      }

      const imageMessage = WhatsAppApi.ImageMessageSchema.safeParse(waMessage)
      if (imageMessage.success) {
        return {
          ...notification,
          message: {
            messageId: imageMessage.data.id,
            type: 'image',
            caption: imageMessage.data.image.caption,
            data: await fetchReceivedMedia(
              imageMessage.data.image.id,
              imageMessage.data.image.sha256
            ),
            mimeType: imageMessage.data.image.mime_type,
          },
        }
      }

      const buttonMessage = WhatsAppApi.TemplateButtonMessageSchema.safeParse(waMessage)
      if (buttonMessage.success) {
        return {
          ...notification,
          message: {
            messageId: buttonMessage.data.id,
            type: 'text',
            text: buttonMessage.data.button.text,
          },
        }
      }

      const interactiveMessage = WhatsAppApi.InteractiveReplyMessageSchema.safeParse(waMessage)
      if (interactiveMessage.success) {
        return {
          ...notification,
          message: {
            messageId: interactiveMessage.data.id,
            type: 'text',
            text:
              interactiveMessage.data.interactive.button_reply?.title ||
              interactiveMessage.data.interactive.list_reply?.title ||
              '',
          },
        }
      }

      return {
        ...notification,
        message: {
          messageId: waMessage.id,
          type: 'unsupported',
          unsupportedType: waMessage.type,
        },
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
        })) as WhatsAppApi.AcknowledgeMessageResponse

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
        })) as WhatsAppApi.AcknowledgeMessageResponse

      if (response.success) {
        console.log(`Typing indicator sent: ${messageId}`)
        return
      }

      console.error(
        `Failed to send typing indicator: ${response.error?.code} ${response.error?.type} ${response.error?.message}`,
        response.error?.error_data?.details
      )
    },

    sendText: async (userId, message) => {
      const { text, replyingTo } = message
      const requestBody: WhatsAppApi.OutgoingText = {
        messaging_product: 'whatsapp',
        to: userId,
        type: 'text',
        text: { body: text, preview_url: true },
        ...(replyingTo && { context: { message_id: replyingTo } }),
      }

      return await sendMessageRequest(requestBody)
    },

    sendImage: async (userId, message) => {
      const { data, caption, mimeType, replyingTo } = message
      const mediaId = await uploadMedia(data, mimeType)

      const requestBody: WhatsAppApi.OutgoingImage = {
        messaging_product: 'whatsapp',
        to: userId,
        type: 'image',
        image: {
          id: mediaId,
          caption: caption || undefined,
        },
        ...(replyingTo && { context: { message_id: replyingTo } }),
      }
      return await sendMessageRequest(requestBody)
    },

    sendDocument: async (userId, message) => {
      const { data, filename, caption, mimeType, replyingTo } = message
      const mediaId = await uploadMedia(data, mimeType, filename)

      const requestBody: WhatsAppApi.OutgoingDocument = {
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

      return await sendMessageRequest(requestBody)
    },

    sendLocation: async (userId, message) => {
      const { latitude, longitude, name, address, replyingTo } = message
      const requestBody: WhatsAppApi.OutgoingLocation = {
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

    sendReaction: async (userId, message) => {
      const { targetMessageId, emoji } = message
      const requestBody: WhatsAppApi.OutgoingReaction = {
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

    sendContact: async (userId, message) => {
      const name = message.name.trim()
      const phone = normalizePhoneNumber(message.phone)

      const requestBody: WhatsAppApi.OutgoingContact = {
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

    sendInteractiveList: async (userId, message) => {
      const { header, body, footer, openListButton, sections, replyingTo } = message
      const $sections: WhatsAppApi.OutgoingInteractiveList['interactive']['action']['sections'] = []
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
      const requestBody: WhatsAppApi.OutgoingInteractiveList = {
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

    sendInteractiveButton: async (userId, message) => {
      const { header, body, footer, buttons, replyingTo } = message
      const requestBody: WhatsAppApi.OutgoingInteractiveButton = {
        messaging_product: 'whatsapp',
        to: userId,
        type: 'interactive',
        interactive: {
          type: 'button',
          header: header ? { type: 'text', text: header.slice(0, 60) } : undefined,
          body: { text: body.slice(0, 1024) },
          footer: footer ? { text: footer.slice(0, 60) } : undefined,
          action: {
            buttons: buttons.slice(0, 3).map((button) => ({
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

    sendInteractiveCtaUrl: async (userId, message) => {
      const { header, body, footer, action, replyingTo } = message
      const requestBody: WhatsAppApi.OutgoingInteractiveCtaUrl = {
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

    sendTemplate: async (userId, message) => {
      const { name, language, headerParameters, bodyParameters, footerParameters } = message
      const components: Array<WhatsAppApi.TemplateComponent> = []
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
      const requestBody: WhatsAppApi.OutgoingTemplate = {
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

function convertParameters(params: TemplateParameters): Array<WhatsAppApi.TemplateTextParameter> {
  if (Array.isArray(params)) {
    return params.map((parameter) => ({ type: 'text', text: parameter }))
  }
  return Object.entries(params).map(([key, value]) => ({
    type: 'text',
    parameter_name: key,
    text: value,
  }))
}
