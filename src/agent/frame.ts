import type { ChunkData, MessageType, User } from '../infra/db'

export class Frame {
  user?: User
  inbound?: FrameMessage & {
    media?: {
      data?: ArrayBuffer
      mimeType?: string
      filename?: string
      storageKey?: string
      transcription?: string
      transcriptionEmbedding?: Array<ChunkData>
    }
  }
  outbound?: FrameMessage
  outboundFile?: {
    externalChatId: string
    type: 'image' | 'document'
    storageKey: string
    caption?: string
  }
  lastSearchFiles?: Array<{
    messageId: string
    filename?: string
  }>
  profileVersionId?: string
}

export interface FrameMessage {
  externalChatId?: string
  type: MessageType
  text?: string
  textEmbedding?: Array<ChunkData>
  messageId?: string
}
