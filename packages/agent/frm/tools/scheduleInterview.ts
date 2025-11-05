import { tool } from 'ai'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { bookSlotByDateTime, saveData, updateCandidate } from '../lib/dataStore'
import type { Interview } from '../types'
import type { FrmToolContext } from './index'

export function createScheduleInterviewTool(ctx: FrmToolContext) {
  return tool({
    name: 'schedule_interview',
    description: 'Schedule an interview for a candidate at a specific date and time.',
    inputSchema: z.object({
      date: z.string().describe('Date in YYYY-MM-DD format'),
      time: z.string().describe('Time in HH:MM format'),
    }),
    execute: async ({ date, time }) => {
      // Use the candidate from context
      const candidate = ctx.candidate

      // Book the slot by date and time
      const bookedSlot = bookSlotByDateTime(date, time, candidate.id)

      if (!bookedSlot) {
        return `Cannot schedule interview: slot ${date} at ${time} is not available.`
      }

      // Create interview
      const interview: Interview = {
        id: randomUUID(),
        candidateId: candidate.id,
        candidateName: candidate.name,
        slotId: bookedSlot.id,
        status: 'scheduled',
        scheduledAt: new Date(`${date}T${time}`),
      }

      // Add interview to data store
      const { dataStore } = await import('../lib/dataStore')
      dataStore.interviews.set(interview.id, interview)

      // Update candidate flow
      candidate.currentFlow = 'completed'
      updateCandidate(candidate)

      // Save data
      await saveData()

      return `Interview scheduled successfully for ${candidate.name} on ${date} at ${time}.`
    },
  })
}
