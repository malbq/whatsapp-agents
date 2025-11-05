import { tool } from 'ai'
import { z } from 'zod'
import { getAvailableSlots } from '../lib/dataStore'

export function createConsultScheduleTool() {
  return tool({
    name: 'consult_schedule',
    description: 'Consult available interview slots for scheduling.',
    inputSchema: z.object({}),
    execute: async () => {
      const slots = getAvailableSlots()

      if (slots.length === 0) {
        return 'No available slots found.'
      }

      // Group by date
      const groupedByDate = slots.reduce(
        (acc: Record<string, string[]>, slot) => {
          const dateKey = slot.date
          if (!acc[dateKey]) acc[dateKey] = []
          acc[dateKey].push(slot.time)
          return acc
        },
        {} as Record<string, string[]>
      )

      let response = 'Available interview slots:\n'
      Object.entries(groupedByDate).forEach(([date, times]) => {
        response += `\n${date}: ${(times as string[]).join(', ')}`
      })

      return response
    },
  })
}
