import { tool } from 'ai'
import { z } from 'zod'
import type { FrmToolContext } from './index'

export function createCancelInterviewTool(ctx: FrmToolContext) {
  return tool({
    name: 'cancel_interview',
    description: 'Cancel a scheduled interview for a candidate.',
    inputSchema: z.object({}),
    execute: async () => {
      const interviews = await ctx.frmDB.listInterviews()
      const interview = interviews.find(
        (i) => i.candidateId === ctx.candidate.id && i.status === 'scheduled'
      )

      if (!interview) {
        return `No scheduled interview found for ${ctx.candidate.name}.`
      }

      await ctx.frmDB.updateInterview({
        ...interview,
        status: 'cancelled',
      })

      await ctx.frmDB.freeSlot(interview.slotId)

      ctx.candidate.currentFlow = 'completed'
      await ctx.frmDB.updateCandidate(ctx.candidate)

      return `Interview for ${ctx.candidate.name} has been cancelled successfully.`
    },
  })
}
