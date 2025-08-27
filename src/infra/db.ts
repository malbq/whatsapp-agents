import type { AIMessage } from './ai'

export interface ChunkData {
  content: string
  embedding: Array<number>
}

export interface User {
  id: string
  externalId: string
  name: string
  joinedAt: Date
  profile: string
}

export type MessageRole = AIMessage['role']
export type MessageType = 'text' | 'voice' | 'audio' | 'document' | 'image' | 'unsupported'

export interface DbMessageInput {
  userId: string
  role: MessageRole
  externalId?: string
  type: MessageType
  storageKey?: string
  content: Array<ChunkData>
}

export type RecentMessage = {
  id: string
  role: MessageRole
  content: string
}

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
  persistUser: (params: { externalId: string; name: string }) => Promise<User>
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
