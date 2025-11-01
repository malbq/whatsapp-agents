import type { ChunkData, MessageType, User } from '../../core/infra/db'

export class Frame {
  user?: User
  inbound?: FrameInboundMessage
  outboundMessages: FrameOutboundMessage[] = []
  lastSearchFiles?: Array<{
    messageId: string
    filename?: string
  }>
  profileVersionId?: string
  profileVersionSourceMessageId?: string
}

export interface FrameInboundMessage {
  externalChatId?: string
  type: MessageType
  text?: string
  textEmbedding?: Array<ChunkData>
  storageKey?: string
  caption?: string
  media?: {
    data?: ArrayBuffer
    mimeType?: string
    filename?: string
    storageKey?: string
    transcription?: string
    transcriptionEmbedding?: Array<ChunkData>
  }
}

export interface FrameOutboundMessage {
  externalChatId?: string
  type: MessageType
  text: string
  textEmbedding?: Array<ChunkData>
  storageKey?: string
}
