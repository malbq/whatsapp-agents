import type { MessageRole, MessageType } from '../domain'
import type { ChunkData } from '../infra/db'

export class Frame {
  user?: UserProfile
  inbound?: InboundMessage
  outbound?: OutboundMessage
  retrieval?: RetrievalResults

  setUser(u: UserProfile) {
    this.user = u
  }

  setInbound(msg: InboundMessage) {
    this.inbound = msg
  }

  ensureOutbound(init?: Partial<OutboundMessage>) {
    if (!this.outbound) {
      this.outbound = {
        role: 'assistant',
        type: 'text',
        priority: 0,
        ...init,
      }
    }
    return this.outbound
  }
}

export interface UserProfile {
  id: string
  externalId: string
  name: string
  joinedAt: Date
  profile: string
}

export interface InboundMessage {
  externalId?: string
  role: MessageRole
  type: MessageType
  priority: number
  text?: string
  image?: {
    description?: string
    data?: ArrayBuffer
    mimeType?: string
    filename?: string
  }
  document?: {
    transcription?: string
    filename?: string
    data?: ArrayBuffer
    mimeType?: string
  }
  media?: {
    data?: ArrayBuffer
    mimeType?: string
    filename?: string
  }
  stored?: {
    storageKey: string
  }
  embedding?: {
    chunks: Array<ChunkData>
  }
}

export interface OutboundMessage {
  role: MessageRole
  type: MessageType
  priority: number
  text?: string
  image?: {
    description?: string
  }
  document?: {
    transcription?: string
    filename?: string
  }
  media?: {
    data?: ArrayBuffer
    mimeType?: string
    filename?: string
    storedKey?: string
  }
  embedding?: {
    chunks: Array<ChunkData>
  }
}

export interface RetrievalResults {
  vectors?: Array<{ content: string; metadata: any }>
}
