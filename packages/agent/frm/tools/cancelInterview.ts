import { tool } from 'ai'
import { z } from 'zod'
import type { FrmToolContext } from '../types'

export function createCancelInterviewTool(ctx: FrmToolContext) {
  return tool({
    name: 'cancel_interview',
    description: 'Cancel a scheduled interview for a candidate.',
    inputSchema: z.object({
      candidateName: z
        .string()
        .describe('Name of the candidate whose interview should be cancelled'),
    }),
    execute: async ({ candidateName }) => {
      // Find candidate
      const candidate = Array.from(ctx.dataStore.candidates.values()).find(
        (c) => c.name.toLowerCase() === candidateName.toLowerCase()
      )

      if (!candidate) {
        return `Candidate ${candidateName} not found.`
      }

      // Find active interview for this candidate
      const interview = Array.from(ctx.dataStore.interviews.values()).find(
        (i) => i.candidateId === candidate.id && i.status === 'scheduled'
      )

      if (!interview) {
        return `No scheduled interview found for ${candidateName}.`
      }

      // Cancel interview
      interview.status = 'cancelled'

      // Free up the slot
      const slot = ctx.dataStore.availableSlots.find((s) => s.id === interview.slotId)
      if (slot) {
        slot.available = true
        slot.candidateId = undefined
      }

      // Cancel any associated timers
      const timer = Array.from(ctx.dataStore.timers.values()).find(
        (t) => t.interviewId === interview.id && !t.sent
      )
      if (timer) {
        ctx.dataStore.timers.delete(timer.id)
      }

      // Save data
      await ctx.saveData()

      return `Interview for ${candidateName} has been cancelled successfully.`
    },
  })
}
