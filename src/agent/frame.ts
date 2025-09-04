import type { ChunkData, MessageType, User } from '../infra/db'

export class Frame {
  user?: User
  inbound?: FrameMessage
  outbound?: FrameMessage
}

export interface FrameMessage {
  messageId?: string
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
