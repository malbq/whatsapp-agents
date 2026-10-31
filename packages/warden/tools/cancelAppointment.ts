import { tool } from 'ai'
import { z } from 'zod'
import type { ToolContext } from './context'

export const createCancelAppointmentTool = (ctx: ToolContext) =>
  tool({
    title: 'cancel_appointment',
    description: 'Cancel an existing appointment for the customer.',
    inputSchema: z.object({}),
    execute: async () => {
      // Find the customer's upcoming appointment
      const appointments = await ctx.db.getAppointmentsByUserId(ctx.userId)
      const upcomingAppointment = appointments.find(
        (a) => a.status === 'scheduled' && a.scheduledAt > new Date()
      )

      if (!upcomingAppointment) {
        return 'No upcoming appointment found to cancel.'
      }

      await ctx.calendar.cancelAppointment(upcomingAppointment.calendarEventId)
      await ctx.db.updateAppointmentStatus(upcomingAppointment.id, 'cancelled')

      const formattedDate = upcomingAppointment.scheduledAt.toLocaleDateString('en-US', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
      })
      const formattedTime = upcomingAppointment.scheduledAt.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })

      return `Appointment for ${formattedDate} at ${formattedTime} was successfully cancelled.`
    },
  })
