import { PostgresSchema } from '@batman/core/infra/dbPostgresSchema'
import { index, pgTable as table, text } from 'drizzle-orm/pg-core'

// FIXME find a way to re-export automatically or to merge schema more efficiently
export const {
  rawIncomingMessage,
  user,
  message,
  resource,
  snippet,
  reminder,
  userRelations,
  messageRelations,
  resourceRelations,
  snippetRelations,
  reminderRelations,
} = PostgresSchema

export const userProfileVersion = table(
  'user_profile_version',
  {
    id: PostgresSchema.uuidv7().primaryKey(),
    userId: text('user_id').notNull(),
    profile: text('profile').notNull(),
    messageId: text('message_id').notNull(),
  },
  (table) => [index('idx_user_profile_version_user_id').on(table.userId)]
)
