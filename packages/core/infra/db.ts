import type { InArgs, ResultSet } from '@libsql/client'

export interface ChunkData {
  content: string
  embedding: Array<number>
}

export interface User {
  id: string
  externalId: string
  name: string
  joinedAt: Date
}

export type MessageRole = 'user' | 'assistant'
export type MessageType =
  | 'text'
  | 'voice'
  | 'audio'
  | 'document'
  | 'image'
  | 'reaction'
  | 'unsupported'

export interface DbMessageInput {
  userId: string
  role: MessageRole
  externalId?: string
  type: MessageType
  content: Array<ChunkData>
}

export type RecentMessage = {
  id: string
  role: MessageRole
  content: string
  type: MessageType
}

export type SimilarMessage = {
  id: string
  role: MessageRole
  type: MessageType
  content: string
  timestamp: Date
  chunkSequence: number
  totalChunks: number
}

export interface DB {
  query: (sql: string, args?: InArgs) => Promise<ResultSet>
  storeWebhookEvent: (payload: string, externalId: string) => Promise<boolean>
  persistUser: (params: { externalId: string; name: string }) => Promise<User>
  storeMessage: (messages: Array<DbMessageInput>) => Promise<Array<string>>
  findRecentMessages: (params: { userId: string }) => Promise<Array<RecentMessage>>
  findSimilarMessages: (params: {
    userId: string
    queryEmbedding: Array<number>
    excludeIds?: Array<string>
  }) => Promise<Array<SimilarMessage>>
}
