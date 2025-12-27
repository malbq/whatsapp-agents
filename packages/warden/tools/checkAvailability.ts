import { tool } from 'ai'
import { z } from 'zod'
import type { ToolContext } from './context'

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
      const startDate = new Date()
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + daysAhead)

      const slots = await ctx.calendar.checkAvailability(startDate, endDate)

      if (slots.length === 0) {
        return 'Não há horários disponíveis nos próximos dias.'
      }

      // Group by date
      const groupedByDate: Record<string, string[]> = {}
      for (const slot of slots) {
        const dateKey = slot.start.toLocaleDateString('pt-BR', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
        })
        if (!groupedByDate[dateKey]) groupedByDate[dateKey] = []
        groupedByDate[dateKey].push(
          slot.start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        )
      }

      let response = 'Horários disponíveis:\n'
      for (const [date, times] of Object.entries(groupedByDate)) {
        response += `\n${date}: ${times.join(', ')}`
      }

      return response
    },
  })
