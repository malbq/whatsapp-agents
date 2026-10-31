import { Hono } from 'hono'
import { z } from 'zod'
import type { WardenDB } from '../db'
import type { AuthMiddleware } from '../lib/authMiddleware'

const availabilitySettingsSchema = z.object({
  bufferMinutes: z.number().min(0).max(120).optional(),
  minNoticeMinutes: z.number().min(0).max(10080).optional(), // max 1 week
  minRescheduleNoticeMinutes: z.number().min(0).max(10080).optional(),
  granularityMinutes: z.number().min(5).max(120).optional(),
  maxDaysAhead: z.number().min(1).max(90).optional(),
})

const workingHoursEntrySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format'),
})

const workingHoursSchema = z.array(workingHoursEntrySchema)

export function createAvailabilitySettingsRoute(db: WardenDB, auth: AuthMiddleware) {
  const app = new Hono()

  app.use('*', auth.requireAuthApi)

  // Get all availability settings
  app.get('/', async (c) => {
    const [settings, workingHours] = await Promise.all([
      db.getAvailabilitySettings(),
      db.getWorkingHours(),
    ])

    return c.json({
      settings,
      workingHours,
    })
  })

  // Update availability settings
  app.patch('/settings', async (c) => {
    const body = await c.req.json()

    const validation = availabilitySettingsSchema.safeParse(body)
    if (!validation.success) {
      return c.json({ error: validation.error.issues[0]?.message }, 400)
    }

    await db.updateAvailabilitySettings(validation.data)

    const settings = await db.getAvailabilitySettings()
    return c.json({ success: true, settings })
  })

  // Replace working hours
  app.put('/working-hours', async (c) => {
    const body = await c.req.json()

    const validation = workingHoursSchema.safeParse(body)
    if (!validation.success) {
      return c.json({ error: validation.error.issues[0]?.message }, 400)
    }

    // Validate that end time is after start time for each entry
    for (const entry of validation.data) {
      if (entry.startTime >= entry.endTime) {
        return c.json(
          { error: `Invalid time range for day ${entry.dayOfWeek}: start must be before end` },
          400
        )
      }
    }

    await db.setWorkingHours(validation.data)

    const workingHours = await db.getWorkingHours()
    return c.json({ success: true, workingHours })
  })

  // Toggle force busy for a calendar
  app.patch('/calendar/:calendarId/force-busy', async (c) => {
    const calendarId = decodeURIComponent(c.req.param('calendarId'))
    const body = await c.req.json<{ forceBusy: boolean }>()

    const schema = z.object({
      forceBusy: z.boolean(),
    })

    const validation = schema.safeParse(body)
    if (!validation.success) {
      return c.json({ error: validation.error.issues[0]?.message }, 400)
    }

    await db.setCalendarForceBusy(calendarId, validation.data.forceBusy)

    return c.json({ success: true })
  })

  return app
}
