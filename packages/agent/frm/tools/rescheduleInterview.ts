import { tool } from 'ai'
import { z } from 'zod'
import { bookSlotByDateTime, freeSlot, saveData, updateCandidate } from '../lib/dataStore'
import type { FrmToolContext } from './index'

export function createRescheduleInterviewTool(ctx: FrmToolContext) {
  return tool({
    name: 'reschedule_interview',
    description: 'Reschedule an existing interview to a new date and time.',
    inputSchema: z.object({
      newDate: z.string().describe('New date in YYYY-MM-DD format'),
      newTime: z.string().describe('New time in HH:MM format'),
    }),
    execute: async ({ newDate, newTime }) => {
      // Import dataStore to access interviews
      const { dataStore } = await import('../lib/dataStore')

      // Find active interview for this candidate
      const interview = Array.from(dataStore.interviews.values()).find(
        (i: any) => i.candidateId === ctx.candidate.id && i.status === 'scheduled'
      )

      if (!interview) {
        return `No scheduled interview found for ${ctx.candidate.name}.`
      }

      // Book new slot by date and time
      const newSlot = bookSlotByDateTime(newDate, newTime, ctx.candidate.id)

      if (!newSlot) {
        return `Cannot reschedule: the new slot ${newDate} at ${newTime} is not available.`
      }

      // Free up old slot
      freeSlot(interview.slotId)

      // Update interview
      interview.slotId = newSlot.id
      interview.scheduledAt = new Date(`${newDate}T${newTime}`)

      // Update candidate
      ctx.candidate.currentFlow = 'completed'
      updateCandidate(ctx.candidate)

      // Save data
      await saveData()

      return `Interview for ${ctx.candidate.name} has been rescheduled to ${newDate} at ${newTime}.`
    },
  })
}
