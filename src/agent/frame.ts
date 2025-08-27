import type { ChunkData, MessageType, User } from '../infra/db'

/** TODO
 * - refatorar tudo com opencode
 * - transcrições devem passar por split e embedding
 * - repensar system prompts relativos a documentos, imagens e audio
 */

export class FrameRefac {
  user?: User
  inbound?: {
    messageId: string
    externalChatId: string
    type: MessageType
    text: string
    media: {
      data: ArrayBuffer
      mimeType: string
      filename: string
      storageKey: string
      transcription: string
    }
    embeddedContent?: Array<ChunkData>
  }
  outbound?: {
    externalChatId: string
    text: string
    retrieveStorageKey: string
    embeddedContent?: Array<ChunkData>
  }
}

export class Frame {
  user?: User
  inbound?: FrameMessage
  systemMessages: Array<FrameMessage> = []
  outbound?: FrameMessage
}

export interface FrameMessage {
  id?: string
  externalId?: string
  type: MessageType
  text?: string
  media?: {
    data: ArrayBuffer
    mimeType: string
    storageKey?: string
  }
  audio?: {
    transcription: string
  }
  image?: {
    description: string
  }
  document?: {
    transcription?: string
    filename: string
  }
  retrieval?: {
    storageKey: string
  }
  embeddedContent?: Array<ChunkData>
}
