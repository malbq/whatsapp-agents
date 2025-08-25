import type { MessageComponent } from '../agent/components'
import type { StatusUpdate } from '../domain'

export interface IncomingMessage {
  userExternalId: string
  userName: string
  externalId: string
  type: MessageComponent['type']
  text?: string
  mediaData?: ArrayBuffer
  mimeType?: string
  documentFilename?: string
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
