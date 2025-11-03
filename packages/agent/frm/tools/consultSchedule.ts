import { tool } from 'ai'
import { z } from 'zod'
import type { FrmToolContext } from '../types'

export function createConsultScheduleTool(ctx: FrmToolContext) {
  return tool({
    name: 'consult_schedule',
    description: 'Consult available interview slots for scheduling.',
    inputSchema: z.object({
      date: z
        .string()
        .optional()
        .describe(
          'Specific date to check (YYYY-MM-DD format). If not provided, shows next 7 days.'
        ),
    }),
    execute: async ({ date }) => {
      const slots = ctx.dataStore.availableSlots.filter((slot) => slot.available)

      let filteredSlots = slots
      if (date) {
        filteredSlots = slots.filter((slot) => slot.date === date)
      } else {
        // Show next 7 days
        const today = new Date().toISOString().split('T')[0] || new Date().toISOString()
        const sevenDaysFromNow = new Date()
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
        const maxDate =
          sevenDaysFromNow.toISOString().split('T')[0] || sevenDaysFromNow.toISOString()

        filteredSlots = slots.filter((slot) => slot.date >= today && slot.date <= maxDate)
      }

      if (filteredSlots.length === 0) {
        return date
          ? `No available slots found for ${date}.`
          : 'No available slots found for the next 7 days.'
      }

      // Group by date
      const groupedByDate = filteredSlots.reduce((acc, slot) => {
        const dateKey = slot.date
        if (!acc[dateKey]) acc[dateKey] = []
        acc[dateKey].push(slot.time)
        return acc
      }, {} as Record<string, string[]>)

      let response = 'Available interview slots:\n'
      Object.entries(groupedByDate).forEach(([date, times]) => {
        response += `\n${date}: ${times.join(', ')}`
      })

      return response
    },
  })
}
