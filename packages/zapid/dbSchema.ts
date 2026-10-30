import { PostgresSchema } from '@wa/core/infra/dbSchema'
import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  json,
  pgTable,
  pgView,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

// FIXME find a way to re-export automatically or to merge schema more efficiently
export const {
  rawIncomingMessage,
  user,
  message,
  tokenUsage,
  resource,
  snippet,
  reminder,
  messageRelations,
  tokenUsageRelations,
  resourceRelations,
  snippetRelations,
  reminderRelations,
} = PostgresSchema

export const userProfileVersion = pgTable(
  'user_profile_version',
  {
    id: PostgresSchema.uuidv7().primaryKey(),
    userId: text().notNull(),
    profile: text().notNull(),
    messageId: text().notNull(),
  },
  (table) => [index('idx_user_profile_version_user_id').on(table.userId)]
)

export const plan = pgTable('plan', {
  id: text().notNull().unique(),
  active: boolean().notNull().default(true),
  metadata: json().$type<Record<string, unknown>>(),
  createdAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
})

export const userSubscription = pgTable(
  'user_subscription',
  {
    id: PostgresSchema.uuidv7().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id),
    planId: text()
      .notNull()
      .references(() => plan.id),
    startedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [index('idx_user_subscription_user_id').on(table.userId)]
)

export const planEntitlement = pgTable(
  'plan_entitlement',
  {
    planId: text()
      .notNull()
      .references(() => plan.id),
    key: text().notNull(),
    value: text(),
  },
  (table) => [primaryKey({ columns: [table.planId, table.key] })]
)

export const userEntitlementOverride = pgTable(
  'user_entitlement_override',
  {
    userId: text()
      .notNull()
      .references(() => user.id),
    key: text().notNull(),
    value: text(),
    notes: text(),
    updatedAt: timestamp({ mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.key] })]
)

export const userEntitlementLedger = pgTable(
  'user_entitlement_ledger',
  {
    id: PostgresSchema.uuidv7().primaryKey(),
    userId: text()
      .notNull()
      .references(() => user.id),
    key: text().notNull(),
    value: integer().notNull(),
    timestamp: timestamp({ mode: 'date' }).notNull().defaultNow(),
    metadata: json().$type<Record<string, unknown>>(),
  },
  (table) => [
    index('idx_user_entitlement_ledger_user_key_ts').on(table.userId, table.key, table.timestamp),
    index('idx_user_entitlement_ledger_key_ts').on(table.key, table.timestamp),
  ]
)

export const userQuota = pgView('v_user_quota', {
  userId: text().notNull(),
  key: text().notNull(),
  limit: integer(),
  used: integer().notNull(),
  remaining: integer(),
}).as(sql`
  WITH daily_usage AS (
    SELECT
      "userId",
      key,
      COALESCE(SUM(value), 0) AS used_24h
    FROM user_entitlement_ledger
    WHERE "timestamp" >= (NOW() - INTERVAL '24 hours')
    GROUP BY "userId", key
  ),
  storage_usage AS (
    SELECT
      "userId",
      COALESCE(SUM(size), 0) AS used_bytes
    FROM resource
    GROUP BY "userId"
  ),
  latest_subscription AS (
    SELECT DISTINCT ON ("userId") "userId", "planId"
    FROM user_subscription
    ORDER BY "userId", "startedAt" DESC
  ),
  resolved_entitlements AS (
    SELECT
      u.id AS "userId",
      pe.key,
      CAST(COALESCE(ueo.value, pe.value) AS INTEGER) AS limit_value
    FROM "user" u
    JOIN latest_subscription us ON us."userId" = u.id
    JOIN plan_entitlement pe ON pe."planId" = us."planId"
    LEFT JOIN user_entitlement_override ueo ON ueo."userId" = u.id AND ueo.key = pe.key
    WHERE pe.key IN (
      'n_messages_per_day',
      'n_web_search_calls_per_day',
      'n_google_places_calls_per_day',
      'n_storage_size'
    )
  )
  SELECT
    re."userId",
    re.key,
    re.limit_value AS "limit",
    CASE
      WHEN re.key = 'n_storage_size' THEN COALESCE(su.used_bytes, 0)
      ELSE COALESCE(du.used_24h, 0)
    END AS used,
    CASE
      WHEN re.limit_value IS NULL THEN NULL
      WHEN re.key = 'n_storage_size' THEN
        GREATEST(re.limit_value - COALESCE(su.used_bytes, 0), 0)
      ELSE
        GREATEST(re.limit_value - COALESCE(du.used_24h, 0), 0)
    END AS remaining
  FROM resolved_entitlements re
  LEFT JOIN daily_usage du ON du."userId" = re."userId" AND du.key = re.key
  LEFT JOIN storage_usage su ON su."userId" = re."userId"
`)

export const userRelations = relations(user, ({ many }) => ({
  profileVersions: many(userProfileVersion),
  messages: many(message),
  resources: many(resource),
  reminders: many(reminder),
  subscriptions: many(userSubscription),
  entitlementOverrides: many(userEntitlementOverride),
  userEntitlementLedgerEntries: many(userEntitlementLedger),
}))

export const planRelations = relations(plan, ({ many }) => ({
  entitlements: many(planEntitlement),
  subscriptions: many(userSubscription),
}))

export const userSubscriptionRelations = relations(userSubscription, ({ one }) => ({
  user: one(user, {
    fields: [userSubscription.userId],
    references: [user.id],
  }),
  plan: one(plan, {
    fields: [userSubscription.planId],
    references: [plan.id],
  }),
}))

export const planEntitlementRelations = relations(planEntitlement, ({ one }) => ({
  plan: one(plan, {
    fields: [planEntitlement.planId],
    references: [plan.id],
  }),
}))

export const userEntitlementOverrideRelations = relations(userEntitlementOverride, ({ one }) => ({
  user: one(user, {
    fields: [userEntitlementOverride.userId],
    references: [user.id],
  }),
}))

export const userEntitlementLedgerRelations = relations(userEntitlementLedger, ({ one }) => ({
  user: one(user, {
    fields: [userEntitlementLedger.userId],
    references: [user.id],
  }),
}))

export const userProfileVersionRelations = relations(userProfileVersion, ({ one }) => ({
  user: one(user, {
    fields: [userProfileVersion.userId],
    references: [user.id],
  }),
}))
