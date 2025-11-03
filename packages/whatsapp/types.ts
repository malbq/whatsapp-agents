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

interface BaseMessage {
  messageId: string
  type: MessageType
  replyingTo?: string
}

export interface TextMessage extends BaseMessage {
  type: 'text'
  text: string
}

export interface VoiceMessage extends BaseMessage {
  type: 'voice'
  data: ArrayBuffer
  mimeType: string
}

export interface AudioMessage extends BaseMessage {
  type: 'audio'
  data: ArrayBuffer
  mimeType: string
}

export interface DocumentMessage extends BaseMessage {
  type: 'document'
  data: ArrayBuffer
  mimeType: string
  filename: string
  caption?: string
}

export interface ImageMessage extends BaseMessage {
  type: 'image'
  data: ArrayBuffer
  mimeType: string
  caption?: string
}

export interface LocationMessage extends BaseMessage {
  type: 'location'
  latitude: number
  longitude: number
  name?: string
  address?: string
}

export interface ReactionMessage extends BaseMessage {
  type: 'reaction'
  emoji: string
  targetMessageId: string
}

export interface ContactMessage extends BaseMessage {
  type: 'contact'
  name: string
  phone: string
}

export interface InteractiveListMessage extends BaseMessage {
  type: 'interactive_list'
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

export interface InteractiveButtonMessage extends BaseMessage {
  type: 'interactive_button'
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

export interface InteractiveCtaUrlMessage extends BaseMessage {
  type: 'interactive_cta_url'
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

export interface TemplateMessage extends BaseMessage {
  type: 'template'
  name: string
  language: string
  headerParameters?: Array<string>
  bodyParameters: Array<string>
  footerParameters?: Array<string>
}

export interface UnsupportedMessage extends BaseMessage {
  type: 'unsupported'
  unsupportedType?: string
}

export type Message =
  | TextMessage
  | VoiceMessage
  | AudioMessage
  | DocumentMessage
  | ImageMessage
  | LocationMessage
  | ReactionMessage
  | ContactMessage
  | InteractiveListMessage
  | InteractiveButtonMessage
  | InteractiveCtaUrlMessage
  | TemplateMessage
  | UnsupportedMessage

export interface Notification {
  userId: string
  userName: string
}

export type MessageNotification = Notification & {
  message: Message
}

export type StatusUpdateNotification = Notification & {
  statusUpdate: StatusUpdate
}

export type StatusUpdate = 'read' | 'delivered' | 'sent'

export interface Chat {
  parseNotification: (
    notification: unknown
  ) => Promise<MessageNotification | StatusUpdateNotification | null>
  acknowledgeMessage: (messageId: string) => Promise<void>
  sendText: (userId: string, message: Omit<TextMessage, 'messageId' | 'type'>) => Promise<string>
  sendImage: (userId: string, message: Omit<ImageMessage, 'messageId' | 'type'>) => Promise<string>
  sendDocument: (
    userId: string,
    message: Omit<DocumentMessage, 'messageId' | 'type'>
  ) => Promise<string>
  sendLocation: (
    userId: string,
    message: Omit<LocationMessage, 'messageId' | 'type'>
  ) => Promise<string>
  sendReaction: (
    userId: string,
    message: Omit<ReactionMessage, 'messageId' | 'type'>
  ) => Promise<string>
  sendContact: (
    userId: string,
    message: Omit<ContactMessage, 'messageId' | 'type'>
  ) => Promise<string>
  sendInteractiveList: (
    userId: string,
    message: Omit<InteractiveListMessage, 'messageId' | 'type'>
  ) => Promise<string>
  sendInteractiveButton: (
    userId: string,
    message: Omit<InteractiveButtonMessage, 'messageId' | 'type'>
  ) => Promise<string>
  sendInteractiveCtaUrl: (
    userId: string,
    message: Omit<InteractiveCtaUrlMessage, 'messageId' | 'type'>
  ) => Promise<string>
  sendTemplate: (
    userId: string,
    message: Omit<TemplateMessage, 'messageId' | 'type'>
  ) => Promise<string>
}
