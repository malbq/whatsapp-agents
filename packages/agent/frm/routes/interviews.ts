import type { Context } from 'hono'
import { dataStore, freeSlot, saveData } from '../lib/dataStore'

export function createDeleteInterviewRoute() {
  return async (c: Context) => {
    const interviewId = c.req.param('id')

    const interview = dataStore.interviews.get(interviewId)
    if (!interview) {
      return c.json({ success: false, error: 'Interview not found' }, 404)
    }

    // Cancel interview
    interview.status = 'cancelled'

    // Free up the slot
    freeSlot(interview.slotId)

    // Save data
    await saveData()

    return c.json({ success: true })
  }
}
