import type { DB } from '@batman/core/infra/db'
import { Postgres } from '@batman/core/infra/dbPostgres'
import { desc, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import * as schema from './dbSchema'

export interface UserWithProfile extends DB.User {
  profile: string
}

export interface ZapidDB extends DB.Repository {
  updateUserProfile: (params: { userId: string; profile: string }) => Promise<string | null>
  updateProfileVersionMessageId: (params: {
    profileVersionId: string
    messageId: string
  }) => Promise<void>

  // Override persistUser to return UserWithProfile
  persistUser: (params: { waId: string; name: string }) => Promise<UserWithProfile>
}

export const dbFactory = (): ZapidDB => {
  const client = drizzle(import.meta.env.DATABASE_URL, { schema })
  const coreDB = Postgres.dbFactory({ client })

  return {
    ...coreDB,

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

    async updateUserProfile({ userId, profile }) {
      profile = profile.trim()
      if (profile.length === 0) return null

      const insertResult = await client
        .insert(schema.userProfileVersion)
        .values({
          userId,
          profile,
        })
        .returning({ id: schema.userProfileVersion.id })

      return insertResult[0]!.id
    },

    async updateProfileVersionMessageId({ profileVersionId, messageId }) {
      await client
        .update(schema.userProfileVersion)
        .set({ messageId })
        .where(eq(schema.userProfileVersion.id, profileVersionId))
    },
  }
}
