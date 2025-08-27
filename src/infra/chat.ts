import type { MessageType } from './db'

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

export interface Chat {
  parseNotification: (notification: any) => Promise<Notification>
  acknowledgeProcessingMessage: (messageId: string) => Promise<void>
  sendTextMessage: (params: { text: string; replyingTo?: string }) => Promise<string>
  sendImageMessage: (params: {
    data: ArrayBuffer
    caption?: string
    replyingTo?: string
  }) => Promise<string>
  sendDocumentMessage: (params: {
    data: ArrayBuffer
    filename: string
    caption?: string
    replyingTo?: string
  }) => Promise<string>
}
