import { tool } from 'ai'
import { z } from 'zod'
import type { FrmToolContext } from './index'

export function createScheduleInterviewTool(ctx: FrmToolContext) {
  return tool({
    title: 'schedule_interview',
    description: 'Schedule an interview for a candidate at a specific date and time.',
    inputSchema: z.object({
      date: z.string().describe('Date in YYYY-MM-DD format'),
      time: z.string().describe('Time in HH:MM format'),
    }),
    execute: async ({ date, time }) => {
      const candidate = ctx.candidate

      const bookedSlot = await ctx.frmDB.bookSlotByDateTime(date, time, candidate.id)

      if (!bookedSlot) {
        return `Cannot schedule interview: slot ${date} at ${time} is not available.`
      }

      await ctx.frmDB.createInterview({
        candidateId: candidate.id,
        candidateName: candidate.name,
        slotId: bookedSlot.id,
        status: 'scheduled',
        scheduledAt: new Date(`${date}T${time}`),
      })

      candidate.currentFlow = 'completed'
      await ctx.frmDB.updateCandidate(candidate)

      return `Interview scheduled successfully for ${candidate.name} on ${date} at ${time}.`
    },
  })
}
