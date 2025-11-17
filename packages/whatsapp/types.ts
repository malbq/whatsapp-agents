import type { z } from 'zod'
import type {
  audioMessageSchema,
  contactMessageSchema,
  documentMessageSchema,
  imageMessageSchema,
  interactiveButtonMessageSchema,
  interactiveCtaUrlMessageSchema,
  interactiveListMessageSchema,
  locationMessageSchema,
  reactionMessageSchema,
  templateMessageSchema,
  templateParametersSchema,
  textMessageSchema,
  unsupportedMessageSchema,
  voiceMessageSchema,
} from './schema'

export type MessageType =
  | 'text'
  | 'voice'
  | 'audio'
  | 'document'
  | 'image'
  | 'reaction'
  | 'location'
  | 'contact'
  | 'interactive_list'
  | 'interactive_button'
  | 'interactive_cta_url'
  | 'template'
  | 'unsupported'

export type TextMessage = z.infer<typeof textMessageSchema>
export type VoiceMessage = z.infer<typeof voiceMessageSchema>
export type AudioMessage = z.infer<typeof audioMessageSchema>
export type DocumentMessage = z.infer<typeof documentMessageSchema>
export type ImageMessage = z.infer<typeof imageMessageSchema>
export type LocationMessage = z.infer<typeof locationMessageSchema>
export type ContactMessage = z.infer<typeof contactMessageSchema>
export type ReactionMessage = z.infer<typeof reactionMessageSchema>
export type InteractiveListMessage = z.infer<typeof interactiveListMessageSchema>
export type InteractiveButtonMessage = z.infer<typeof interactiveButtonMessageSchema>
export type InteractiveCtaUrlMessage = z.infer<typeof interactiveCtaUrlMessageSchema>
export type TemplateParameters = z.infer<typeof templateParametersSchema>
export type TemplateMessage = z.infer<typeof templateMessageSchema>
export type UnsupportedMessage = z.infer<typeof unsupportedMessageSchema>

export type ReplyMessage = {
  replyingTo?: string
}

export type OutgoingMessage =
  | TextMessage
  | DocumentMessage
  | ImageMessage
  | LocationMessage
  | ReactionMessage
  | ContactMessage
  | InteractiveListMessage
  | InteractiveButtonMessage
  | InteractiveCtaUrlMessage
  | TemplateMessage

export type IncominMessage = (
  | TextMessage
  | VoiceMessage
  | AudioMessage
  | DocumentMessage
  | ImageMessage
  | LocationMessage
  | ReactionMessage
  | ContactMessage
) &
  ReplyMessage & { messageWaId: string }

export interface Notification {
  userWaId: string
  userName: string
  userPhone: string
  timestamp: Date
}
export type MessageNotification = Notification & { message: IncominMessage }
export type UnsupportedMessageNotification = Notification & { unsupportedType: string }
export type StatusUpdateNotification = Notification & {
  statusUpdate: StatusUpdate
}

export type StatusUpdate = 'read' | 'delivered' | 'sent'

export interface Chat {
  parseNotification: (
    notification: unknown
  ) => Promise<
    MessageNotification | StatusUpdateNotification | UnsupportedMessageNotification | null
  >
  acknowledgeMessage: (messageId: string) => Promise<void>
  sendTypingIndicator: (messageId: string) => Promise<void>
  sendText: (userId: string, message: Omit<TextMessage, 'type'> & ReplyMessage) => Promise<string>
  sendImage: (userId: string, message: Omit<ImageMessage, 'type'> & ReplyMessage) => Promise<string>
  sendDocument: (
    userId: string,
    message: Omit<DocumentMessage, 'type'> & ReplyMessage
  ) => Promise<string>
  sendLocation: (
    userId: string,
    message: Omit<LocationMessage, 'type'> & ReplyMessage
  ) => Promise<string>
  sendReaction: (
    userId: string,
    message: Omit<ReactionMessage, 'type'> & ReplyMessage
  ) => Promise<string>
  sendContact: (
    userId: string,
    message: Omit<ContactMessage, 'type'> & ReplyMessage
  ) => Promise<string>
  sendInteractiveList: (
    userId: string,
    message: Omit<InteractiveListMessage, 'type'> & ReplyMessage
  ) => Promise<string>
  sendInteractiveButton: (
    userId: string,
    message: Omit<InteractiveButtonMessage, 'type'> & ReplyMessage
  ) => Promise<string>
  sendInteractiveCtaUrl: (
    userId: string,
    message: Omit<InteractiveCtaUrlMessage, 'type'> & ReplyMessage
  ) => Promise<string>
  sendTemplate: (
    userId: string,
    message: Omit<TemplateMessage, 'type'> & ReplyMessage
  ) => Promise<string>
}
