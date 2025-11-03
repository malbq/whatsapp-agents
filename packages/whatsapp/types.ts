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
  waId: string
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
  externalChatId: string
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
  userExternalId: string
  userName: string
  message?: Message
  statusUpdate?: StatusUpdate
}

export type StatusUpdate = 'read' | 'delivered' | 'sent'

export interface Chat {
  parseNotification: (notification: unknown) => Promise<Notification | null>
  acknowledgeMessage: (messageId: string) => Promise<void>
  sendText: (userWhatsappId: string, message: TextMessage) => Promise<string>
  sendImage: (userWhatsappId: string, message: ImageMessage) => Promise<string>
  sendDocument: (userWhatsappId: string, message: DocumentMessage) => Promise<string>
  sendLocation: (userWhatsappId: string, message: LocationMessage) => Promise<string>
  sendReaction: (userWhatsappId: string, message: ReactionMessage) => Promise<string>
  sendContact: (userWhatsappId: string, message: ContactMessage) => Promise<string>
  sendInteractiveList: (userWhatsappId: string, message: InteractiveListMessage) => Promise<string>
  sendInteractiveButton: (
    userWhatsappId: string,
    message: InteractiveButtonMessage
  ) => Promise<string>
  sendInteractiveCtaUrl: (
    userWhatsappId: string,
    message: InteractiveCtaUrlMessage
  ) => Promise<string>
  sendTemplate: (userWhatsappId: string, message: TemplateMessage) => Promise<string>
}
