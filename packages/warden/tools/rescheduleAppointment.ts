import { tool } from 'ai'
import { z } from 'zod'
import { parseDate } from '../lib/dateUtils'
import type { ToolContext } from './context'

export const createRescheduleAppointmentTool = (ctx: ToolContext) =>
  tool({
    title: 'reschedule_appointment',
    description: 'Reschedule an existing appointment to a new date and time.',
    inputSchema: z.object({
      newDate: z.string().describe('New date in YYYY-MM-DD format'),
      newTime: z.string().describe('New time in HH:MM format'),
    }),
    execute: async ({ newDate, newTime }) => {
      // Find the customer's upcoming appointment
      const appointments = await ctx.db.getAppointmentsByUserId(ctx.userId)
      const upcomingAppointment = appointments.find(
        (a) => a.status === 'scheduled' && a.scheduledAt > new Date()
      )

      if (!upcomingAppointment) {
        return 'No upcoming appointment found to reschedule.'
      }

      // Get calendar timezone
      const timezone = await ctx.calendar.getCalendarTimezone()

      // Parse time
      const [hours, minutes] = newTime.split(':').map(Number)
      if (hours === undefined || minutes === undefined || Number.isNaN(hours) || Number.isNaN(minutes)) {
        return `Invalid time: ${newTime}`
      }

      // Create date in calendar's timezone
      const newStart = parseDate({ date: newDate, hour: hours, minute: minutes, timezone })
      if (Number.isNaN(newStart.getTime())) {
        return `Invalid date or time: ${newDate} ${newTime}`
      }

      // Default 30 min duration
      const newEnd = new Date(newStart.getTime() + 30 * 60 * 1000)

      await ctx.calendar.updateAppointment(upcomingAppointment.calendarEventId, {
        start: newStart,
        end: newEnd,
      })

      // Update local reference
      await ctx.db.updateAppointmentStatus(upcomingAppointment.id, 'scheduled')

      const formattedDate = newStart.toLocaleDateString('en-US', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: timezone,
      })
      const formattedTime = newStart.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
      })

      return `Appointment successfully rescheduled for ${formattedDate} at ${formattedTime}.`
    },
  })
