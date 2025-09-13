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
  filename: string
  caption?: string
  replyingTo?: string
  mimeType: string
}

export interface Chat {
  parseNotification: (notification: any) => Promise<Notification>
  acknowledgeProcessingMessage: (messageId: string) => Promise<void>
  sendTextMessage: (params: OutgoingTextMessage) => Promise<string>
  sendImageMessage: (params: OutgoingImageMessage) => Promise<string>
  sendDocumentMessage: (params: OutgoingDocumentMessage) => Promise<string>
}
