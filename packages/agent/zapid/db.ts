import type { DB } from '@batman/core/infra/db'
import { Postgres } from '@batman/core/infra/dbPostgres'
import { desc, eq } from 'drizzle-orm'
import { userProfileVersion } from './dbSchema'

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
  const coreDB = Postgres.dbFactory({ url: 'postgresql://localhost/zapid' })

  return {
    ...coreDB,

    // Override persistUser to return UserWithProfile
    async persistUser(params) {
      const user = await coreDB.persistUser(params)

      const profileResult = await coreDB.client
        .select({ profile: userProfileVersion.profile })
        .from(userProfileVersion)
        .where(eq(userProfileVersion.userId, user.id))
        .orderBy(desc(userProfileVersion.id))
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

      const insertResult = await coreDB.client
        .insert(userProfileVersion)
        .values({
          userId,
          profile,
        })
        .returning({ id: userProfileVersion.id })

      return insertResult[0]!.id
    },

    async updateProfileVersionMessageId({ profileVersionId, messageId }) {
      await coreDB.client
        .update(userProfileVersion)
        .set({ messageId })
        .where(eq(userProfileVersion.id, profileVersionId))
    },
  }
}
