// ============================================================================
// Internal WhatsApp Business API types
// ============================================================================
//
// These types map directly to Meta's WhatsApp Business API payloads.
// They are internal to the whatsapp package and should NOT be exported
// to external consumers. Agents should only use types from types.ts.
//
// Documentation: https://developers.facebook.com/docs/whatsapp/cloud-api
// ============================================================================

export type WaAcknowledgeMessageResponse = {
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

export type WaNotification = {
  object: 'whatsapp_business_account'
  entry: Array<WaEntry>
}

export type WaOutgoingMessageResponse = {
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

export type WaMessagesChange = {
  field: 'messages'
  value: {
    messaging_product: 'whatsapp'
    metadata: WaMessagesChangeMetadata
    contacts?: Array<WaContact>
    messages?: Array<
      | WaTextMessage
      | WaAudioMessage
      | WaDocumentMessage
      | WaImageMessage
      | WaReactionMessage
      | WaLocationMessage
      | WaContactsMessage
      | WaStickerMessage
      | WaButtonMessage
    >
    statuses?: Array<WaStatusUpdate>
  }
}

export type WaMessageType =
  | 'text'
  | 'audio'
  | 'document'
  | 'image'
  | 'reaction'
  | 'location'
  | 'contacts'
  | 'sticker'
  | 'button'
  | 'unsupported'

export interface WaIncomingMessage {
  type: WaMessageType
  id: string
  from: string
  timestamp: string
}

export interface WaUnsupportedMessage extends WaIncomingMessage {
  type: 'unsupported'
  errors: Array<{
    code: number
    title: string
    message: string
    error_data: {
      details: string
    }
  }>
}

export interface WaTextMessage extends WaIncomingMessage {
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

export interface WaAudioMessage extends WaIncomingMessage {
  type: 'audio'
  audio: Media & {
    mime_type: 'audio/ogg; codecs=opus'
    voice: boolean
  }
}

export interface WaDocumentMessage extends WaIncomingMessage {
  type: 'document'
  document: Media & {
    mime_type: 'application/pdf'
    caption?: string
    filename: string
  }
}

export interface WaImageMessage extends WaIncomingMessage {
  type: 'image'
  image: Media & {
    mime_type: 'image/jpeg'
    caption?: string
  }
}

export interface WaStickerMessage extends WaIncomingMessage {
  type: 'sticker'
  sticker: Media & {
    mime_type: 'image/webp'
    animated: boolean
  }
}

export interface WaContactsMessage extends WaIncomingMessage {
  type: 'contacts'
  contacts: Array<unknown>
}

export interface WaLocationMessage extends WaIncomingMessage {
  type: 'location'
  location: {
    latitude: number
    longitude: number
  }
}

export interface WaReactionMessage extends WaIncomingMessage {
  type: 'reaction'
  reaction: {
    message_id: string
    emoji: string
  }
}

export interface WaButtonMessage extends WaIncomingMessage {
  type: 'button'
  button: {
    payload: string
    text: string
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
  parameter_name?: string
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

export type WaEntry = {
  id: string
  changes: Array<WaMessagesChange>
}

export type WaMessagesChangeMetadata = {
  display_phone_number: string
  phone_number_id: string
}

export type WaContact = {
  wa_id: string
  profile: {
    name: string
  }
}

export type WaStatusUpdate = {
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

export type WaMediaUrlResponse = {
  messaging_product: 'whatsapp'
  url: string
  mime_type: string
  sha256: string
  file_size: number
  id: string
}
