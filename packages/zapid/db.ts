import type { DB } from '@wa/core/infra/db'
import { Postgres, type PostgresClient, type PostgresOptions } from '@wa/core/infra/dbPostgres'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import * as schema from './dbSchema'
import {
  BOOLEAN_ENTITLEMENTS,
  NUMERIC_ENTITLEMENTS,
  STARTER_PLAN_ID,
  type BooleanEntitlementKey,
  type DailyLedgerEntitlementKey,
  type NumericEntitlementKey,
} from './systems/entitlements'

export interface UserWithProfile extends DB.User {
  profile: string
}

interface RemainingUsage {
  limit: number | null
  used: number
  remaining: number | null
}

export interface UserEntitlements {
  features: Record<BooleanEntitlementKey, boolean>
  quotas: Record<NumericEntitlementKey, RemainingUsage>
}

export type ZapidClient = PostgresClient<typeof schema>

export interface ZapidRepository extends DB.Repository {
  $client: ZapidClient
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
  insertUserEntitlementLedger: (params: {
    userId: string
    key: DailyLedgerEntitlementKey
    value: number
    metadata?: Record<string, unknown> | null
  }) => Promise<void>
}

export const createZapidRepository = (
  client: ZapidClient,
  options?: PostgresOptions
): ZapidRepository => {
  const coreDB = Postgres.dbFactory({ client, options })

  async function hasSubscription(userId: string): Promise<boolean> {
    const rows = await client
      .select({ id: schema.userSubscription.id })
      .from(schema.userSubscription)
      .where(eq(schema.userSubscription.userId, userId))
      .limit(1)
    return rows.length > 0
  }

  return {
    ...coreDB,
    $client: client,

    // Override persistUser to return UserWithProfile
    async persistUser(params) {
      const user = await coreDB.persistUser(params)

      const profileResult = await client.query.userProfileVersion.findFirst({
        columns: { profile: true },
        where: eq(schema.userProfileVersion.userId, user.id),
        orderBy: ({ id }) => [desc(id)],
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
              orderBy: (profile) => [desc(profile.id)],
            },
          },
          where: (user) => eq(user.id, id),
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
              orderBy: (profile) => [desc(profile.id)],
            },
          },
          where: (user) => eq(user.waId, waId),
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
      return hasSubscription(userId)
    },

    async completeOnboarding({ userId }) {
      if (await hasSubscription(userId)) return
      await client.insert(schema.userSubscription).values({ userId, planId: STARTER_PLAN_ID })
    },

    async getUserEntitlements({ userId }) {
      // Get the latest subscription for this user
      const latestSubscription = await client
        .select({ planId: schema.userSubscription.planId })
        .from(schema.userSubscription)
        .where(eq(schema.userSubscription.userId, userId))
        .orderBy(desc(schema.userSubscription.startedAt))
        .limit(1)

      const subscription = latestSubscription[0]
      if (!subscription) {
        // No subscription found, return empty entitlements
        const features = Object.fromEntries(
          BOOLEAN_ENTITLEMENTS.map((key) => [key, false])
        ) as Record<BooleanEntitlementKey, boolean>

        const quotas = Object.fromEntries(
          NUMERIC_ENTITLEMENTS.map((key) => [key, { limit: 0, used: 0, remaining: 0 }])
        ) as Record<NumericEntitlementKey, RemainingUsage>

        return { features, quotas }
      }

      const { planId } = subscription

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
          .from(schema.planEntitlement)
          .leftJoin(
            schema.userEntitlementOverride,
            and(
              eq(schema.userEntitlementOverride.userId, userId),
              eq(schema.userEntitlementOverride.key, schema.planEntitlement.key)
            )
          )
          .where(
            and(
              eq(schema.planEntitlement.planId, planId),
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

    async insertUserEntitlementLedger({ userId, key, value, metadata }) {
      await client.insert(schema.userEntitlementLedger).values({
        userId,
        key,
        value,
        metadata: metadata ?? null,
      })
    },
  }
}
