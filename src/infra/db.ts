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
  chunkSequence: number
  totalChunks: number
}

export interface FileSearchResult {
  messageId: string
  storageKey: string
  score: number
  snippet: string
  timestamp: Date
}

export type ReminderStatus = 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed'

export interface Reminder {
  id: string
  userId: string
  status: ReminderStatus
  dueAt: Date
  description: string
  message: string
  createdAt: Date
  updatedAt: Date
  sentAt?: Date
  waMessageId?: string
  error?: string
  recurrenceCron?: string
}

export interface ReminderCreateParams {
  userId: string
  dueAt: Date
  description: string
  message: string
  recurrenceCron?: string
}

export interface ReminderListItem {
  id: string
  dueAt: Date
  description: string
  message: string
}

export interface DueReminderItem {
  id: string
  userId: string
  message: string
  isReclaimed: boolean
}

export interface DB {
  storeWebhookEvent: (payload: string, externalId: string) => Promise<boolean>
  persistUser: (params: { externalId: string; name: string }) => Promise<User>
  updateUserProfile: (params: { userId: string; profile: string }) => Promise<void>
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
  createReminder: (params: ReminderCreateParams) => Promise<{ id: string }>
  cancelReminder: (params: { id: string }) => Promise<boolean>
  listUpcomingReminders: (params: {
    userId: string
    limit?: number
  }) => Promise<Array<ReminderListItem>>
  takeDueReminders: (params: { now: Date; limit?: number }) => Promise<Array<DueReminderItem>>
  markReminderSent: (params: { id: string; waMessageId: string }) => Promise<void>
  markReminderFailed: (params: { id: string; error: string }) => Promise<void>
}
