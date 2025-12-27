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
        return 'Não encontrei nenhum agendamento futuro para cancelar.'
      }

      await ctx.calendar.cancelAppointment(upcomingAppointment.calendarEventId)
      await ctx.db.updateAppointmentStatus(upcomingAppointment.id, 'cancelled')

      const formattedDate = upcomingAppointment.scheduledAt.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
      })
      const formattedTime = upcomingAppointment.scheduledAt.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })

      return `Agendamento para ${formattedDate} às ${formattedTime} foi cancelado com sucesso.`
    },
  })
