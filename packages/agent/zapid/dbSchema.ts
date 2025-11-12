import { PostgresSchema } from '@batman/core/infra/dbPostgresSchema'
import { index, pgTable as table, text } from 'drizzle-orm/pg-core'

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
