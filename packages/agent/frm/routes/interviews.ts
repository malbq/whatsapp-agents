import type { Context } from 'hono'
import type { FrmDB } from '../db'

export function createDeleteInterviewRoute(frmDB: FrmDB) {
  return async (c: Context) => {
    const interviewId = c.req.param('id')

    const interview = await frmDB.getInterview(interviewId)
    if (!interview) {
      return c.json({ success: false, error: 'Interview not found' }, 404)
    }

    await frmDB.updateInterview({
      ...interview,
      status: 'cancelled',
    })

    await frmDB.freeSlot(interview.slotId)

    return c.json({ success: true })
  }
}
