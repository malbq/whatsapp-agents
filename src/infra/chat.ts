import type { Message, StatusUpdate } from '../domain/message'
import type { User } from '../domain/user'

export interface Notification {
  chatUser?: Pick<User, 'externalId' | 'name'>
  message?: Message
  statusUpdate?: StatusUpdate
}

export interface Chat {
  parseNotification: (notification: any) => Notification

  acknowledgeProcessingMessage: (
    from: string,
    messageId: string
  ) => Promise<void>

  sendTextMessage: (params: {
    from: string
    to: string
    text: string
    replyingTo?: string
  }) => Promise<void>

  fetchReceivedMedia: (mediaId: string) => Promise<{
    media: ArrayBuffer
    mimeType: string
  }>
}
