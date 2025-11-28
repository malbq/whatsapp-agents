import { getContext } from '../context'
import { type DailyLedgerEntitlementKey, hasQuotaRemaining, recordUsage } from './entitlements'

export type EnforcementResult =
  | { allowed: true }
  | { allowed: false; reason: 'quota_exceeded'; key: string; message: string }
  | { allowed: false; reason: 'feature_disabled'; key: string; message: string }
  | { allowed: false; reason: 'no_plan'; message: string }

export function checkMessageQuota(): EnforcementResult {
  if (!hasQuotaRemaining('n_messages_per_day')) {
    return {
      allowed: false,
      reason: 'quota_exceeded',
      key: 'n_messages_per_day',
      message: getQuotaExceededMessage('n_messages_per_day'),
    }
  }

  return { allowed: true }
}

export async function recordMessageUsage(): Promise<void> {
  const { user } = getContext()
  const userId = user?.id

  if (!userId) {
    return
  }

  await recordUsage(userId, 'n_messages_per_day', 1)
}

function getQuotaExceededMessage(key: DailyLedgerEntitlementKey | 'n_storage_size'): string {
  switch (key) {
    case 'n_messages_per_day':
      return 'Você atingiu o limite de mensagens de hoje. Volte amanhã ou faça upgrade do seu plano.'
    case 'n_web_search_calls_per_day':
      return 'Você atingiu o limite de buscas na web de hoje.'
    case 'n_google_places_calls_per_day':
      return 'Você atingiu o limite de buscas de lugares de hoje.'
    default:
      return 'Você atingiu o limite de uso para esta funcionalidade.'
  }
}
