import type { Context } from 'hono'
import { dataStore } from '../lib/dataStore'
import { DashboardPage } from '../ui/pages'

export async function dashboardRoute(c: Context) {
  const candidates = Array.from(dataStore.candidates.values())
  const slots = dataStore.availableSlots
  const interviews = Array.from(dataStore.interviews.values())
  const startSecretToken = import.meta.env.START_SECRET_TOKEN || ''
  return c.html(DashboardPage({ candidates, slots, interviews, startSecretToken }))
}
