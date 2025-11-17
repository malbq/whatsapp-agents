import type { DB } from '@batman/core/infra/db'
import { Postgres } from '@batman/core/infra/dbPostgres'
import { desc, eq } from 'drizzle-orm'
import { BunSQLDatabase, drizzle } from 'drizzle-orm/bun-sql'
import * as schema from './dbSchema'

export interface UserWithProfile extends DB.User {
  profile: string
}

export interface ZapidRepository extends DB.Repository {
  $client: BunSQLDatabase<typeof schema>
  updateUserProfile: (params: {
    userId: string
    profile: string
    messageId: string
  }) => Promise<void>

  // Override persistUser to return UserWithProfile
  persistUser: (params: { waId: string; name: string }) => Promise<UserWithProfile>
}

export const dbFactory = (): ZapidRepository => {
  const client = drizzle(import.meta.env.DATABASE_URL, { schema })
  const coreDB = Postgres.dbFactory({ client })

  return {
    ...coreDB,
    $client: client,

    // Override persistUser to return UserWithProfile
    async persistUser(params) {
      const user = await coreDB.persistUser(params)

      const profileResult = await client
        .select({ profile: schema.userProfileVersion.profile })
        .from(schema.userProfileVersion)
        .where(eq(schema.userProfileVersion.userId, user.id))
        .orderBy(desc(schema.userProfileVersion.id))
        .limit(1)

      const profile = profileResult[0]?.profile ?? ''

      return {
        ...user,
        profile,
      }
    },

    async updateUserProfile({ userId, profile, messageId }) {
      profile = profile.trim()
      if (profile.length === 0) return

      await client.insert(schema.userProfileVersion).values({
        userId,
        profile,
        messageId,
      })
    },
  }
}
