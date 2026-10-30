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
        return 'Nao encontrei nenhum agendamento futuro para reagendar.'
      }

      // Get calendar timezone
      const timezone = await ctx.calendar.getCalendarTimezone()

      // Parse time
      const [hours, minutes] = newTime.split(':').map(Number)
      if (hours === undefined || minutes === undefined || Number.isNaN(hours) || Number.isNaN(minutes)) {
        return `Horario invalido: ${newTime}`
      }

      // Create date in calendar's timezone
      const newStart = parseDate({ date: newDate, hour: hours, minute: minutes, timezone })
      if (Number.isNaN(newStart.getTime())) {
        return `Data ou horario invalido: ${newDate} ${newTime}`
      }

      // Default 30 min duration
      const newEnd = new Date(newStart.getTime() + 30 * 60 * 1000)

      await ctx.calendar.updateAppointment(upcomingAppointment.calendarEventId, {
        start: newStart,
        end: newEnd,
      })

      // Update local reference
      await ctx.db.updateAppointmentStatus(upcomingAppointment.id, 'scheduled')

      const formattedDate = newStart.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: timezone,
      })
      const formattedTime = newStart.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
      })

      return `Agendamento reagendado com sucesso para ${formattedDate} as ${formattedTime}.`
    },
  })
