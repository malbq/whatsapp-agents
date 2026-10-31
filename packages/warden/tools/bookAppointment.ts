import { tool } from 'ai'
import { z } from 'zod'
import { parseDate } from '../lib/dateUtils'
import type { ToolContext } from './context'

export const createBookAppointmentTool = (ctx: ToolContext) =>
  tool({
    title: 'book_appointment',
    description: 'Book an appointment for the customer at a specific date and time.',
    inputSchema: z.object({
      date: z.string().describe('Date in YYYY-MM-DD format'),
      time: z.string().describe('Time in HH:MM format'),
      serviceName: z.string().optional().describe('Name of the service being booked'),
    }),
    execute: async ({ date, time, serviceName }) => {
      // Get calendar timezone
      const timezone = await ctx.calendar.getCalendarTimezone()
      
      // Parse time
      const [hours, minutes] = time.split(':').map(Number)
      if (hours === undefined || minutes === undefined || Number.isNaN(hours) || Number.isNaN(minutes)) {
        return `Invalid time: ${time}`
      }
      
      // Create date in calendar's timezone
      const startDate = parseDate({ date, hour: hours, minute: minutes, timezone })
      if (Number.isNaN(startDate.getTime())) {
        return `Invalid date or time: ${date} ${time}`
      }

      // Default 30 min duration - in future this would come from service config
      const endDate = new Date(startDate.getTime() + 30 * 60 * 1000)

      const appointment = await ctx.calendar.bookAppointment(
        { start: startDate, end: endDate },
        ctx.userName,
        ctx.userPhone,
        serviceName
      )

      // Store local reference
      await ctx.db.createAppointment({
        calendarEventId: appointment.id,
        userId: ctx.userId,
        scheduledAt: appointment.start,
        status: 'scheduled',
      })

      const formattedDate = appointment.start.toLocaleDateString('en-US', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: timezone,
      })
      const formattedTime = appointment.start.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
      })

      return `Appointment successfully booked for ${formattedDate} at ${formattedTime}.`
    },
  })
