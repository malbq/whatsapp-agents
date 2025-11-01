import type { MessageType } from '../core/infra/db'

export interface IncomingMessage {
  userExternalId: string
  userName: string
  externalId: string
  type: MessageType
  text?: string
  mediaData?: ArrayBuffer
  mimeType?: string
  documentFilename?: string
}

export type StatusUpdate = {
  status: 'read' | 'delivered' | 'sent'
}

export interface Notification {
  message?: IncomingMessage
  statusUpdate?: StatusUpdate
}

export interface OutgoingTextMessage {
  text: string
  replyingTo?: string
}
export interface OutgoingImageMessage {
  data: ArrayBuffer
  caption?: string
  replyingTo?: string
  mimeType: string
}
export interface OutgoingDocumentMessage {
  data: ArrayBuffer
  filename?: string
  caption?: string
  replyingTo?: string
  mimeType: string
}
export interface OutgoingLocationMessage {
  latitude: number
  longitude: number
  name?: string
  address?: string
  replyingTo?: string
}
export interface OutgoingReactionMessage {
  externalChatId: string
  emoji: string
}
export interface OutgoingContactMessage {
  name: string
  phone: string
}
export interface OutgoingInteractiveListMessage {
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
  replyingTo?: string
}
export interface OutgoingInteractiveButtonMessage {
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
  replyingTo?: string
}
export interface OutgoingInteractiveCtaUrlMessage {
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
  replyingTo?: string
}

export interface OutgoingTemplateMessage {
  name: string
  language: string
  headerParameters?: Array<string>
  bodyParameters: Array<string>
  footerParameters?: Array<string>
}

export interface Chat {
  parseNotification: (notification: any) => Promise<Notification>
  acknowledgeMessage: (messageId: string) => Promise<void>
  sendText: (params: OutgoingTextMessage) => Promise<string>
  sendImage: (params: OutgoingImageMessage) => Promise<string>
  sendDocument: (params: OutgoingDocumentMessage) => Promise<string>
  sendLocation: (params: OutgoingLocationMessage) => Promise<string>
  sendReaction: (params: OutgoingReactionMessage) => Promise<string>
  sendContact: (params: OutgoingContactMessage) => Promise<string>
  sendInteractiveList: (params: OutgoingInteractiveListMessage) => Promise<string>
  sendInteractiveButton: (params: OutgoingInteractiveButtonMessage) => Promise<string>
  sendInteractiveCtaUrl: (params: OutgoingInteractiveCtaUrlMessage) => Promise<string>
  sendTemplate: (params: OutgoingTemplateMessage) => Promise<string>
}
