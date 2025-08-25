import type { UserComponent } from '../agent/components'
import type { MessageRole, MessageType } from '../domain'

export interface ChunkData {
  content: string
  embedding: Array<number>
}

export interface DbMessageInput {
  externalId?: string
  userId: string
  role: MessageRole
  type: MessageType
  storageKey?: string
  content: Array<ChunkData>
}

export type RecentMessage = { id: string; role: MessageRole; content: string }
export type SimilarMessage = {
  id: string
  role: MessageRole
  type: MessageType
  content: string
  timestamp: Date
}

export interface FileSearchResult {
  messageId: string
  storageKey: string
  score: number
  snippet: string
  timestamp: Date
}

export interface DB {
  storeWebhookEvent: (payload: string) => Promise<void>
  persistUser: (params: { externalId: string; name: string }) => Promise<UserComponent>
  updateUserProfile: (params: {
    userId: string
    profile: string
    messageId?: string
  }) => Promise<void>
  storeMessage: (messages: Array<DbMessageInput>) => Promise<Array<string>>
  findRecentMessages: (params: { userId: string }) => Promise<Array<RecentMessage>>
  findSimilarMessages: (params: {
    userId: string
    queryEmbedding: Array<number>
    excludeIds?: Array<string>
  }) => Promise<Array<SimilarMessage>>
  searchFiles: (params: {
    userId: string
    queryEmbedding: Array<number>
  }) => Promise<Array<FileSearchResult>>
}
