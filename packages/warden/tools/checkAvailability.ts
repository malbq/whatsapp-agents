import { tool } from 'ai'
import { z } from 'zod'
import type { ToolContext } from './context'

const DEFAULT_DURATION_MINUTES = 30

export const createCheckAvailabilityTool = (ctx: ToolContext) =>
  tool({
    title: 'check_availability',
    description: 'Check available appointment slots for the next few days.',
    inputSchema: z.object({
      daysAhead: z
        .number()
        .min(1)
        .max(14)
        .default(7)
        .describe('Number of days ahead to check availability (default 7, max 14)'),
    }),
    execute: async ({ daysAhead }) => {
      // Load settings and working hours from DB
      const [settings, workingHours] = await Promise.all([
        ctx.db.getAvailabilitySettings(),
        ctx.db.getWorkingHours(),
      ])

      // Get calendar configuration
      const appointmentCalendarId = await ctx.db.getAppointmentCalendarId()
      if (!appointmentCalendarId) {
        return 'No appointment calendar configured.'
      }

      const [enabledCalendarIds, forceBusyCalendarIds, timezone] = await Promise.all([
        ctx.db.getEnabledCalendarIds(),
        ctx.db.getForceBusyCalendarIds(),
        ctx.calendar.getCalendarTimezone(),
      ])

      const startDate = new Date()
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + daysAhead)

      const result = await ctx.calendar.checkAvailability({
        startDate,
        endDate,
        durationMinutes: DEFAULT_DURATION_MINUTES,
        settings,
        workingHours,
        busyCalendarIds: enabledCalendarIds,
        forceBusyCalendarIds,
        appointmentCalendarId,
        timezone,
      })

      if (result.slots.length === 0) {
        return 'No available times in the next few days.'
      }

      // Group by date using the calendar's timezone
      const groupedByDate: Record<string, string[]> = {}
      for (const slot of result.slots) {
        const dateKey = slot.start.toLocaleDateString('en-US', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          timeZone: result.timezone,
        })
        if (!groupedByDate[dateKey]) groupedByDate[dateKey] = []
        groupedByDate[dateKey].push(
          slot.start.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: result.timezone,
          })
        )
      }

      let response = 'Available times:\n'
      for (const [date, times] of Object.entries(groupedByDate)) {
        response += `\n${date}: ${times.join(', ')}`
      }

      return response
    },
  })
