import chalk from 'chalk'
const { META_API_TOKEN, WA_API_VERSION } = process.env

export namespace WA {
  export function parseNotification(body: Notification) {
    const change = body.entry?.[0]?.changes?.[0]

    if (!change) return

    if (change.value.messages?.length) {
      const message = change.value.messages[0]!
      const businessPhoneNumberId = change.value.metadata.phone_number_id

      return {
        message,
        businessPhoneNumberId,
      }
    }

    if (change.value.statuses?.length) {
      const statusUpdate = change.value.statuses[0]!

      return {
        statusUpdate,
      }
    }
  }

  export async function markAsReadAndStartTyping(
    businessPhoneNumberId: string,
    messageId: string
  ) {
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

    const data = (await response.json()) as { success?: boolean }
    if (!data.success) {
      console.error('Failed to mark message as read', JSON.stringify(data))
    }

    console.debug('Marked as read')
  }

  export async function sendTextMessage(params: {
    businessPhoneNumberId: string
    toPhoneNumber: string
    text: string
    replyToMessage?: string
  }) {
    const {
      businessPhoneNumberId,
      toPhoneNumber,
      text,
      replyToMessage: replyTo,
    } = params

    const requestBody: any = {
      messaging_product: 'whatsapp',
      to: toPhoneNumber,
      text: { body: text },
    }

    if (replyTo) {
      requestBody.context = {
        message_id: replyTo,
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
    return data
  }

  export async function downloadMedia(mediaId: string) {
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
      media: await mediaResponse.blob(),
      mimeType: urlData.mime_type,
    }
  }

  export type Notification = {
    object: 'whatsapp_business_account'
    entry: Array<Entry>
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

  export interface Message {
    type: MessageType
    id: string
    from: string
    timestamp: string
  }

  export interface TextMessage extends Message {
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

  export interface AudioMessage extends Message {
    type: 'audio'
    audio: Media & {
      mime_type: 'audio/ogg; codecs=opus'
      voice: boolean
    }
  }

  export interface DocumentMessage extends Message {
    type: 'document'
    document: Media & {
      mime_type: 'application/pdf'
      filename: string
    }
  }

  export interface ImageMessage extends Message {
    type: 'image'
    image: Media & {
      mime_type: 'image/jpeg'
      caption?: string
    }
  }

  export interface StickerMessage extends Message {
    type: 'sticker'
    sticker: Media & {
      mime_type: 'image/webp'
      animated: boolean
    }
  }

  export interface ContactsMessage extends Message {
    type: 'contacts'
    contacts: Array<any>
  }

  export interface LocationMessage extends Message {
    type: 'location'
    location: {
      latitude: number
      longitude: number
    }
  }

  export interface ReactionMessage extends Message {
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
