import { eq } from 'drizzle-orm'
import type { ZapidRepository } from '../db'
import * as schema from '../dbSchema'
import { ALL_ENTITLEMENTS } from './entitlements'

export async function validatePlanCatalogue(db: ZapidRepository): Promise<void> {
  const plans = await db.$client.select().from(schema.plan).where(eq(schema.plan.active, true))

  if (plans.length === 0) {
    throw new Error('No active plans found. Run scripts/seedPlans.sql to seed the plan catalogue.')
  }

  for (const plan of plans) {
    const entitlements = await db.$client
      .select({ key: schema.planEntitlement.key })
      .from(schema.planEntitlement)
      .where(eq(schema.planEntitlement.planId, plan.id))

    const configuredKeys = new Set(entitlements.map((e) => e.key))
    const missingKeys = ALL_ENTITLEMENTS.filter((key) => !configuredKeys.has(key))

    if (missingKeys.length > 0) {
      throw new Error(
        `Plan '${plan.id}' is missing entitlements: ${missingKeys.join(
          ', '
        )}. Run scripts/seedPlans.sql to fix.`
      )
    }
  }
}
