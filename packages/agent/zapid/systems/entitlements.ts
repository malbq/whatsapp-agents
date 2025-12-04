import { getContext } from '../context'

export const STARTER_PLAN_ID = 'free'

export const BOOLEAN_ENTITLEMENTS = [
  'b_enable_profile_tool',
  'b_enable_file_retrieval',
  'b_enable_web_fetch_tool',
  'b_enable_memory_tool',
  'b_enable_web_search_tool',
  'b_enable_google_places_tool',
] as const

export type BooleanEntitlementKey = (typeof BOOLEAN_ENTITLEMENTS)[number]

export const NUMERIC_ENTITLEMENTS = [
  'n_messages_per_day',
  'n_storage_size',
  'n_web_search_calls_per_day',
  'n_google_places_calls_per_day',
] as const

export type NumericEntitlementKey = (typeof NUMERIC_ENTITLEMENTS)[number]

const DAILY_LEDGER_ENTITLEMENTS = [
  'n_messages_per_day',
  'n_web_search_calls_per_day',
  'n_google_places_calls_per_day',
] as const

export type DailyLedgerEntitlementKey = (typeof DAILY_LEDGER_ENTITLEMENTS)[number]

export const ALL_ENTITLEMENTS = [...BOOLEAN_ENTITLEMENTS, ...NUMERIC_ENTITLEMENTS] as const

export async function recordUsage(
  key: DailyLedgerEntitlementKey,
  value: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  const { user, db } = getContext()
  if (!DAILY_LEDGER_ENTITLEMENTS.includes(key)) {
    console.warn(`Cannot record usage for non-daily entitlement: ${key}`)
    return
  }

  await db.insertUsageLedger({ userId: user.id, key, value, metadata })
}

export function isFeatureEnabled(key: BooleanEntitlementKey): boolean {
  const { entitlements } = getContext()
  return entitlements.features[key]
}

export function hasQuotaRemaining(key: DailyLedgerEntitlementKey): boolean {
  const { entitlements } = getContext()
  const quota = entitlements.quotas[key]
  return quota.remaining === null || quota.remaining > 0
}

export function hasStorageCapacity(additionalBytes: number): boolean {
  const { entitlements } = getContext()
  const quota = entitlements.quotas['n_storage_size']
  return quota.limit === null || quota.used + additionalBytes <= quota.limit
}
