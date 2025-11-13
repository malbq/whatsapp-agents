import type { AssistantModelMessage, ToolModelMessage, UserModelMessage } from 'ai'
import type { UserWithProfile } from './db'

export class Frame {
  user?: UserWithProfile
  inbound?: UserModelMessage
  outbound: (AssistantModelMessage | ToolModelMessage)[] = []
}

// interface FrameInboundMessage {
//   externalChatId?: string
//   type: MessageType
//   text?: string
//   textEmbedding?: Array<ChunkData>
//   storageKey?: string
//   caption?: string
//   media?: {
//     data?: ArrayBuffer
//     mimeType?: string
//     filename?: string
//     storageKey?: string
//     transcription?: string
//     transcriptionEmbedding?: Array<ChunkData>
//   }
// }

// interface FrameOutboundMessage {
//   externalChatId?: string
//   type: MessageType
//   text: string
//   textEmbedding?: Array<ChunkData>
//   storageKey?: string
// }
