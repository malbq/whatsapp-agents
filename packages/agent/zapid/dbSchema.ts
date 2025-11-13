import { PostgresSchema } from '@batman/core/infra/dbPostgresSchema'
import { index, pgTable as table, text } from 'drizzle-orm/pg-core'

// Zapid-specific tables
export const userProfileVersion = table(
  'user_profile_version',
  {
    id: PostgresSchema.uuidv7().primaryKey(),
    userId: text('user_id').notNull(),
    profile: text('profile').notNull(),
    messageId: text('message_id'),
  },
  (table) => [index('idx_user_profile_version_user_id').on(table.userId)]
)

// Re-export core schema tables
export const rawIncomingMessage = PostgresSchema.rawIncomingMessage
export const user = PostgresSchema.user
export const message = PostgresSchema.message
export const resource = PostgresSchema.resource
export const snippet = PostgresSchema.snippet
export const reminder = PostgresSchema.reminder

// Re-export core schema relations
export const messageRelations = PostgresSchema.messageRelations
export const resourceRelations = PostgresSchema.resourceRelations
export const snippetRelations = PostgresSchema.snippetRelations
export const reminderRelations = PostgresSchema.reminderRelations
export const userRelations = PostgresSchema.userRelations
