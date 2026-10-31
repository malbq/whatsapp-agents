import { tool } from 'ai'
import { z } from 'zod'
import type { ToolContext } from './context'

export const createListAppointmentsTool = (ctx: ToolContext) =>
  tool({
    title: 'list_appointments',
    description: 'List upcoming appointments for the customer.',
    inputSchema: z.object({
      includeAll: z
        .boolean()
        .default(false)
        .describe(
          'If true, include past and cancelled appointments. Default is false (only upcoming scheduled appointments).'
        ),
    }),
    execute: async ({ includeAll }) => {
      const timezone = await ctx.calendar.getCalendarTimezone()
      const appointments = await ctx.db.getAppointmentsByUserId(ctx.userId)

      const now = new Date()
      const filteredAppointments = includeAll
        ? appointments
        : appointments.filter((a) => a.status === 'scheduled' && a.scheduledAt > now)

      // Sort by scheduledAt ascending
      filteredAppointments.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())

      if (filteredAppointments.length === 0) {
        return includeAll
          ? 'You have no appointments on record.'
          : 'You have no upcoming appointments.'
      }

      const lines = filteredAppointments.map((appointment) => {
        const formattedDate = appointment.scheduledAt.toLocaleDateString('en-US', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: timezone,
        })
        const formattedTime = appointment.scheduledAt.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: timezone,
        })

        const statusLabel = getStatusLabel(appointment.status)
        return `• ${formattedDate} at ${formattedTime}${statusLabel}`
      })

      const header = includeAll ? 'Your appointments:' : 'Your upcoming appointments:'
      return `${header}\n\n${lines.join('\n')}`
    },
  })

function getStatusLabel(status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed'): string {
  switch (status) {
    case 'scheduled':
      return ''
    case 'confirmed':
      return ' (confirmed)'
    case 'cancelled':
      return ' (cancelled)'
    case 'completed':
      return ' (completed)'
  }
}
