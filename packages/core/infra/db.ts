import type { InferInsertModel, InferSelectModel, Table, TableConfig } from 'drizzle-orm'
import type { PostgresSchema } from './dbPostgresSchema'

type ExtractTable<T> = T extends Table<TableConfig> ? T : never

type SelectModel<TABLE extends string> = TABLE extends keyof typeof PostgresSchema
  ? InferSelectModel<ExtractTable<(typeof PostgresSchema)[TABLE]>>
  : never

type InsertModel<TABLE extends string> = TABLE extends keyof typeof PostgresSchema
  ? InferInsertModel<ExtractTable<(typeof PostgresSchema)[TABLE]>>
  : never

export namespace DB {
  export type MessageType =
    | 'text'
    | 'voice'
    | 'audio'
    | 'document'
    | 'image'
    | 'location'
    | 'contact'
    | 'interactive_list'
    | 'interactive_button'
    | 'interactive_cta_url'
    | 'reaction'
    | 'unsupported'
    | 'tool-call'
    | 'tool-result'

  export type Message = SelectModel<'message'>
  export type User = SelectModel<'user'>
  export type Resource = SelectModel<'resource'>
  export type Reminder = SelectModel<'reminder'>

  export interface Repository {
    storeRawIncomingMessage: (payload: string, waId: string) => Promise<boolean>
    persistUser: (user: InsertModel<'user'>) => Promise<User>
    storeMessage: (
      params: InsertModel<'message'> | Array<InsertModel<'message'>>
    ) => Promise<Array<string>>
    findRecentMessages: (params: { userId: string }) => Promise<Array<Message>>
    findSimilarSnippets: (params: {
      userId: string
      queryEmbedding: Array<number>
      excludeIds?: Array<string>
    }) => Promise<Array<Message>>
    createResource: (params: InsertModel<'resource'>) => Promise<Resource>
    findResource: (params: { userId: string; resourceId: string }) => Promise<Resource | null>
    searchFiles: (params: { userId: string; queryEmbedding: Array<number> }) => Promise<Array<any>>
    createReminder: (params: InsertModel<'reminder'>) => Promise<Reminder>
    cancelReminder: (params: { id: string }) => Promise<boolean>
    listUpcomingReminders: (params: { userId: string; limit?: number }) => Promise<Array<Reminder>>
    takeDueReminders: (params: { now: Date; limit?: number }) => Promise<Array<Reminder>>
    markReminderSent: (params: { id: string; waMessageId: string }) => Promise<void>
    markReminderFailed: (params: { id: string; error: string }) => Promise<void>
    deleteMessages: (params: { userId: string }) => Promise<void>
  }
}
