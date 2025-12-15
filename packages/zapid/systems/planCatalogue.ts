import { eq } from 'drizzle-orm'
import type { ZapidRepository } from '../db'
import * as schema from '../dbSchema'
import { ALL_ENTITLEMENTS, STARTER_PLAN_ID } from './entitlements'

export async function validatePlanCatalogue(db: ZapidRepository): Promise<void> {
  const plans = await db.$client.select().from(schema.plan).where(eq(schema.plan.active, true))

  if (plans.length === 0) {
    throw new Error('No active plans found.')
  }

  if (!plans.some((p) => p.id === STARTER_PLAN_ID)) {
    throw new Error('Free plan not found.')
  }

  await Promise.all(
    plans.map((plan) =>
      db.$client
        .select({ key: schema.planEntitlement.key })
        .from(schema.planEntitlement)
        .where(eq(schema.planEntitlement.planId, plan.id))
        .then((entitlements) => {
          const configuredKeys = new Set(entitlements.map((e) => e.key))
          const missingKeys = ALL_ENTITLEMENTS.filter((key) => !configuredKeys.has(key))

          if (missingKeys.length > 0) {
            throw new Error(`Plan '${plan.id}' is missing entitlements: ${missingKeys.join(', ')}.`)
          }
        })
    )
  )
}
