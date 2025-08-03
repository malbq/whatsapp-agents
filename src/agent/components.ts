import type { MessageRole, MessageType } from '../domain'
import type { AIMessage } from '../infra/ai'
import type { ChunkData } from '../infra/db'

export interface MessageComponent {
  externalId?: string
  role: MessageRole
  type: MessageType
  priority: number
}

export interface MessageIdComponent {
  id: string
}

export interface TextContentComponent {
  text: string
}

export interface MediaComponent {
  data: ArrayBuffer
  mimeType: string
}

export interface StoredMediaComponent {
  storageKey: string
}

export interface ImageContentComponent {
  description: string
}

export interface DocumentContentComponent {
  transcription: string
  filename: string
}

export interface VectorEmbeddingComponent {
  chunks: Array<ChunkData>
}

export interface VectorResultsComponent {
  results: Array<{ content: string; metadata: any }>
}

export interface SimilarityScoreComponent {
  score: number
}

export interface UserComponent {
  id: string
  externalId: string
  name: string
  joinedAt: Date
  profile: string
}

export interface RecentChatComponent {
  messages: Array<AIMessage>
}

export interface ScheduledRemindersComponent {
  reminders: any[]
}

export interface ToolCallComponent {
  name: string
  args: any
  result?: any
}

export interface ReminderComponent {
  content: string
  dueDate: Date
  sent: boolean
}
