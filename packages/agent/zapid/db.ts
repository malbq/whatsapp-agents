import type { DB } from '@batman/core/infra/db'
import { Postgres } from '@batman/core/infra/dbPostgres'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { BunSQLDatabase, drizzle } from 'drizzle-orm/bun-sql'
import * as schema from './dbSchema'
import {
  BOOLEAN_ENTITLEMENTS,
  NUMERIC_ENTITLEMENTS,
  type BooleanEntitlementKey,
  type DailyLedgerEntitlementKey,
  type NumericEntitlementKey,
} from './systems/entitlements'

export interface UserWithProfile extends DB.User {
  profile: string
}

export interface RemainingUsage {
  limit: number | null
  used: number
  remaining: number | null
}

export interface EntitlementOverride {
  value: string | null
}

export interface PlanEntitlementWithPlanId {
  value: string | null
  planId: string
}

export interface UserPlanInfo {
  planId: string
}

export interface UserEntitlements {
  features: Record<BooleanEntitlementKey, boolean>
  quotas: Record<NumericEntitlementKey, RemainingUsage>
}

export interface ZapidRepository extends DB.Repository {
  $client: BunSQLDatabase<typeof schema>
  updateUserProfile: (params: {
    userId: string
    profile: string
    messageId: string
  }) => Promise<void>

  persistUser: (params: { waId: string; name: string }) => Promise<UserWithProfile>
  findUserById: (params: { id: string }) => Promise<UserWithProfile | undefined>
  findUserByWaId: (params: { waId: string }) => Promise<UserWithProfile | undefined>
  hasConsent: (params: { userId: string }) => Promise<boolean>
  completeOnboarding: (params: { userId: string }) => Promise<void>
  getUserEntitlements: (params: { userId: string }) => Promise<UserEntitlements>
  insertUsageLedger: (params: {
    userId: string
    key: DailyLedgerEntitlementKey
    value: number
    metadata?: Record<string, unknown> | null
  }) => Promise<void>
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

      const profileResult = await client.query.userProfileVersion.findFirst({
        columns: { profile: true },
        where: eq(schema.userProfileVersion.userId, user.id),
        orderBy: ({ id }, { desc }) => [desc(id)],
      })

      return {
        ...user,
        profile: profileResult?.profile ?? '',
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

    async findUserById({ id }) {
      return await client.query.user
        .findFirst({
          with: {
            profileVersions: {
              columns: { profile: true },
              limit: 1,
              orderBy: (profile, { desc }) => [desc(profile.id)],
            },
          },
          where: (user, { eq }) => eq(user.id, id),
        })
        .then((result) =>
          result
            ? ({
                id: result.id,
                waId: result.waId,
                name: result.name,
                profile: result.profileVersions?.[0]?.profile ?? '',
                joinedAt: result.joinedAt,
              } satisfies UserWithProfile)
            : undefined
        )
    },

    async findUserByWaId({ waId }) {
      return await client.query.user
        .findFirst({
          with: {
            profileVersions: {
              columns: { profile: true },
              limit: 1,
              orderBy: (profile, { desc }) => [desc(profile.id)],
            },
          },
          where: (user, { eq }) => eq(user.waId, waId),
        })
        .then((result) =>
          result
            ? ({
                id: result.id,
                waId: result.waId,
                name: result.name,
                profile: result.profileVersions?.[0]?.profile ?? '',
                joinedAt: result.joinedAt,
              } satisfies UserWithProfile)
            : undefined
        )
    },

    async hasConsent({ userId }) {
      const result = await client.execute(
        sql`select 1 from ${schema.userConsent} where ${schema.userConsent.userId} = ${userId}`
      )
      if (result.length > 1) {
        console.warn('Multiple consents found for user', { userId })
      }
      return result.length === 1
    },

    async completeOnboarding({ userId }) {
      await client.transaction(async (tx) => {
        await tx.insert(schema.userConsent).values({ userId }).onConflictDoNothing()
        await tx.insert(schema.userPlan).values({ userId, planId: 'free' }).onConflictDoNothing()
      })
    },

    async getUserEntitlements({ userId }) {
      const [usageRows, booleanRows] = await Promise.all([
        client
          .select({
            key: schema.userQuota.key,
            limit: schema.userQuota.limit,
            used: schema.userQuota.used,
            remaining: schema.userQuota.remaining,
          })
          .from(schema.userQuota)
          .where(eq(schema.userQuota.userId, userId)),
        client
          .select({
            key: schema.planEntitlement.key,
            value: sql<string>`COALESCE(${schema.userEntitlementOverride.value}, ${schema.planEntitlement.value})`,
          })
          .from(schema.userPlan)
          .innerJoin(
            schema.planEntitlement,
            eq(schema.userPlan.planId, schema.planEntitlement.planId)
          )
          .leftJoin(
            schema.userEntitlementOverride,
            eq(schema.userPlan.userId, schema.userEntitlementOverride.userId)
          )
          .where(
            and(
              eq(schema.userPlan.userId, userId),
              inArray(schema.planEntitlement.key, BOOLEAN_ENTITLEMENTS)
            )
          ),
      ])

      const features = Object.fromEntries(
        BOOLEAN_ENTITLEMENTS.map((key) => {
          const row = booleanRows.find((r) => r.key === key)
          return [key, row?.value === 'true']
        })
      ) as Record<BooleanEntitlementKey, boolean>

      const quotas = Object.fromEntries(
        NUMERIC_ENTITLEMENTS.map((key) => {
          const row = usageRows.find((r) => r.key === key)
          return [
            key,
            {
              limit: row?.limit ?? null,
              used: row?.used ?? 0,
              remaining: row?.remaining ?? null,
            },
          ]
        })
      ) as Record<NumericEntitlementKey, RemainingUsage>

      return { features, quotas }
    },

    async insertUsageLedger({ userId, key, value, metadata }) {
      await client.insert(schema.usageLedger).values({
        userId,
        key,
        value,
        metadata: metadata ?? null,
      })
    },
  }
}
