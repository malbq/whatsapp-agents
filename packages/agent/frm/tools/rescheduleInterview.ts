import { tool } from 'ai'
import { z } from 'zod'
import type { FrmToolContext } from './index'

export function createRescheduleInterviewTool(ctx: FrmToolContext) {
  return tool({
    title: 'reschedule_interview',
    description: 'Reschedule an existing interview to a new date and time.',
    inputSchema: z.object({
      newDate: z.string().describe('New date in YYYY-MM-DD format'),
      newTime: z.string().describe('New time in HH:MM format'),
    }),
    execute: async ({ newDate, newTime }) => {
      const interviews = await ctx.frmDB.listInterviews()
      const interview = interviews.find(
        (i) => i.candidateId === ctx.candidate.id && i.status === 'scheduled'
      )

      if (!interview) {
        return `No scheduled interview found for ${ctx.candidate.name}.`
      }

      const newSlot = await ctx.frmDB.bookSlotByDateTime(newDate, newTime, ctx.candidate.id)

      if (!newSlot) {
        return `Cannot reschedule: the new slot ${newDate} at ${newTime} is not available.`
      }

      await ctx.frmDB.freeSlot(interview.slotId)

      await ctx.frmDB.updateInterview({
        ...interview,
        slotId: newSlot.id,
        scheduledAt: new Date(`${newDate}T${newTime}`),
      })

      ctx.candidate.currentFlow = 'completed'
      await ctx.frmDB.updateCandidate(ctx.candidate)

      return `Interview for ${ctx.candidate.name} has been rescheduled to ${newDate} at ${newTime}.`
    },
  })
}
