import type { ChunkData, MessageType, User } from '../infra/db'

export class Frame {
  user?: User
  inbound?: FrameMessage
  outbound?: Omit<FrameMessage, 'media'>
  outboundFile?: {
    externalChatId: string
    type: 'image' | 'document'
    storageKey: string
    caption?: string
  }
}

export interface FrameMessage {
  externalChatId?: string
  type: MessageType
  text?: string
  textEmbedding?: Array<ChunkData>
  media?: {
    data?: ArrayBuffer
    mimeType?: string
    filename?: string
    storageKey?: string
    transcription?: string
    transcriptionEmbedding?: Array<ChunkData>
  }
}
