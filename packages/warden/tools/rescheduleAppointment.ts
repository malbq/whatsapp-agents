import { tool } from 'ai'
import { z } from 'zod'
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
        return 'Não encontrei nenhum agendamento futuro para reagendar.'
      }

      // Parse the new date and time
      const newStart = new Date(`${newDate}T${newTime}:00`)
      if (Number.isNaN(newStart.getTime())) {
        return `Data ou horário inválido: ${newDate} ${newTime}`
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
      })
      const formattedTime = newStart.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })

      return `Agendamento reagendado com sucesso para ${formattedDate} às ${formattedTime}.`
    },
  })
