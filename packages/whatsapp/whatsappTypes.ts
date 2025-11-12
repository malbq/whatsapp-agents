import { z } from 'zod'

export namespace WhatsAppApi {
  export const ContactSchema = z.object({
    wa_id: z.string(),
    profile: z.object({
      name: z.string(),
    }),
  })

  export const StatusUpdateSchema = z.object({
    id: z.string(),
    status: z.enum(['read', 'delivered', 'sent']),
    timestamp: z.string(),
    recipient_id: z.string(),
    conversation: z.object({
      id: z.string(),
      origin: z.object({
        type: z.string(),
      }),
    }),
    pricing: z.object({
      billable: z.boolean(),
      pricing_model: z.string(),
      category: z.string(),
    }),
  })

  export const TextMessageSchema = z.object({
    type: z.literal('text'),
    id: z.string(),
    from: z.string(),
    timestamp: z.string(),
    text: z.object({
      body: z.string(),
    }),
    context: z
      .object({
        from: z.string(),
        id: z.string(),
      })
      .optional(),
  })

  export const AudioMessageSchema = z.object({
    type: z.literal('audio'),
    id: z.string(),
    from: z.string(),
    timestamp: z.string(),
    audio: z.object({
      id: z.string(),
      mime_type: z.string(),
      sha256: z.string(),
      voice: z.boolean(),
    }),
  })

  export const DocumentMessageSchema = z.object({
    type: z.literal('document'),
    id: z.string(),
    from: z.string(),
    timestamp: z.string(),
    document: z.object({
      id: z.string(),
      mime_type: z.string(),
      sha256: z.string(),
      caption: z.string().optional(),
      filename: z.string(),
    }),
  })

  export const ImageMessageSchema = z.object({
    type: z.literal('image'),
    id: z.string(),
    from: z.string(),
    timestamp: z.string(),
    image: z.object({
      id: z.string(),
      mime_type: z.string(),
      sha256: z.string(),
      caption: z.string().optional(),
    }),
  })

  export const TemplateButtonMessageSchema = z.object({
    type: z.literal('button'),
    id: z.string(),
    from: z.string(),
    timestamp: z.string(),
    button: z.object({
      payload: z.string(),
      text: z.string(),
    }),
  })

  export const InteractiveReplyMessageSchema = z.object({
    type: z.literal('interactive'),
    id: z.string(),
    from: z.string(),
    timestamp: z.string(),
    interactive: z.object({
      type: z.enum(['button_reply', 'list_reply']),
      button_reply: z
        .object({
          id: z.string(),
          title: z.string(),
        })
        .optional(),
      list_reply: z
        .object({
          id: z.string(),
          title: z.string(),
          description: z.string(),
        })
        .optional(),
    }),
  })

  export const IncomingMessageSchema = z.union([
    TextMessageSchema,
    AudioMessageSchema,
    DocumentMessageSchema,
    ImageMessageSchema,
    TemplateButtonMessageSchema,
    InteractiveReplyMessageSchema,
    z.object({
      type: z.string(),
      id: z.string(),
      from: z.string(),
      timestamp: z.string(),
    }),
  ])

  export const MessagesChangeMetadataSchema = z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  })

  export const MessagesChangeValueSchema = z.object({
    messaging_product: z.literal('whatsapp'),
    metadata: MessagesChangeMetadataSchema,
    contacts: z.array(ContactSchema).optional(),
    messages: z.array(IncomingMessageSchema).optional(),
    statuses: z.array(StatusUpdateSchema).optional(),
  })

  export const MessagesChangeSchema = z.object({
    field: z.literal('messages'),
    value: MessagesChangeValueSchema,
  })

  export const EntrySchema = z.object({
    id: z.string(),
    changes: z.array(MessagesChangeSchema),
  })

  export const NotificationSchema = z.object({
    object: z.literal('whatsapp_business_account'),
    entry: z.array(EntrySchema),
  })

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

  export type Notification = z.infer<typeof NotificationSchema>

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

  export type MessagesChange = z.infer<typeof MessagesChangeSchema>

  export type MessageType =
    | 'text'
    | 'audio'
    | 'document'
    | 'image'
    | 'reaction'
    | 'location'
    | 'contacts'
    | 'sticker'
    | 'button'
    | 'interactive'
    | 'unsupported'

  export interface IncomingMessage {
    type: MessageType
    id: string
    from: string
    timestamp: string
  }

  export interface UnsupportedMessage extends IncomingMessage {
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

  export interface TextMessage extends IncomingMessage {
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

  export interface AudioMessage extends IncomingMessage {
    type: 'audio'
    audio: Media & {
      mime_type: 'audio/ogg; codecs=opus'
      voice: boolean
    }
  }

  export interface DocumentMessage extends IncomingMessage {
    type: 'document'
    document: Media & {
      mime_type: 'application/pdf'
      caption?: string
      filename: string
    }
  }

  export interface ImageMessage extends IncomingMessage {
    type: 'image'
    image: Media & {
      mime_type: 'image/jpeg'
      caption?: string
    }
  }

  export interface StickerMessage extends IncomingMessage {
    type: 'sticker'
    sticker: Media & {
      mime_type: 'image/webp'
      animated: boolean
    }
  }

  export interface ContactsMessage extends IncomingMessage {
    type: 'contacts'
    contacts: Array<unknown>
  }

  export interface LocationMessage extends IncomingMessage {
    type: 'location'
    location: {
      latitude: number
      longitude: number
    }
  }

  export interface ReactionMessage extends IncomingMessage {
    type: 'reaction'
    reaction: {
      message_id: string
      emoji: string
    }
  }

  export interface TemplateButtonMessage extends IncomingMessage {
    type: 'button'
    button: {
      payload: string
      text: string
    }
  }

  export interface InteractiveButtonReplyMessage extends IncomingMessage {
    type: 'interactive'
    interactive: {
      type: 'button_reply' | 'list_reply'
      button_reply?: {
        id: string
        title: string
      }
      list_reply?: {
        id: string
        title: string
        description: string
      }
    }
  }

  export interface OutgoingMessage {
    messaging_product: 'whatsapp'
    to: string
    context?: { message_id: string }
  }

  export interface OutgoingText extends OutgoingMessage {
    type: 'text'
    text: { body: string; preview_url: true }
  }

  export interface OutgoingImage extends OutgoingMessage {
    type: 'image'
    image: {
      id: string
      caption?: string
    }
  }

  export interface OutgoingDocument extends OutgoingMessage {
    type: 'document'
    document: {
      id: string
      filename: string
      caption?: string
    }
  }

  export interface OutgoingLocation extends OutgoingMessage {
    type: 'location'
    location: {
      latitude: number
      longitude: number
      name?: string
      address?: string
    }
  }

  export interface OutgoingReaction extends OutgoingMessage {
    type: 'reaction'
    reaction: {
      message_id: string
      emoji: string
    }
  }

  export interface OutgoingContact extends OutgoingMessage {
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

  export interface OutgoingInteractiveList extends OutgoingMessage {
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
          title?: string
          rows: Array<{
            id: string
            title: string
            description?: string
          }>
        }>
      }
    }
  }

  export interface OutgoingInteractiveButton extends OutgoingMessage {
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

  export interface OutgoingInteractiveCtaUrl extends OutgoingMessage {
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

  export interface OutgoingTemplate extends OutgoingMessage {
    type: 'template'
    template: {
      name: string
      language: {
        code: string
        policy: 'deterministic'
      }
      components: Array<TemplateComponent>
    }
  }

  export type TemplateComponent =
    | TemplateBodyComponent
    | TemplateHeaderComponent
    | TemplateFooterComponent

  export interface TemplateBodyComponent {
    type: 'body'
    parameters: Array<TemplateParameter>
  }

  export interface TemplateHeaderComponent {
    type: 'header'
    parameters: Array<TemplateParameter>
  }

  export interface TemplateFooterComponent {
    type: 'footer'
    parameters: Array<TemplateParameter>
  }

  export type TemplateParameter =
    | TemplateTextParameter
    | TemplateCurrencyParameter
    | TemplateDateTimeParameter

  export interface TemplateTextParameter {
    type: 'text'
    parameter_name?: string
    text: string
  }

  export interface TemplateCurrencyParameter {
    type: 'currency'
    currency: {
      fallback_value: string
      code: string
      amount_1000: number
    }
  }

  export interface TemplateDateTimeParameter {
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

  export type OutgoingMessageUnion =
    | OutgoingText
    | OutgoingImage
    | OutgoingDocument
    | OutgoingLocation
    | OutgoingReaction
    | OutgoingContact
    | OutgoingInteractiveList
    | OutgoingInteractiveButton
    | OutgoingInteractiveCtaUrl
    | OutgoingTemplate

  export type Entry = z.infer<typeof EntrySchema>
  export type MessagesChangeMetadata = z.infer<typeof MessagesChangeMetadataSchema>
  export type Contact = z.infer<typeof ContactSchema>
  export type StatusUpdate = z.infer<typeof StatusUpdateSchema>

  export type MediaUrlResponse = {
    messaging_product: 'whatsapp'
    url: string
    mime_type: string
    sha256: string
    file_size: number
    id: string
  }
}
