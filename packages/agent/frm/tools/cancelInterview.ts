import { tool } from 'ai'
import { z } from 'zod'
import { freeSlot, saveData, updateCandidate } from '../lib/dataStore'
import type { FrmToolContext } from './index'

export function createCancelInterviewTool(ctx: FrmToolContext) {
  return tool({
    name: 'cancel_interview',
    description: 'Cancel a scheduled interview for a candidate.',
    inputSchema: z.object({}),
    execute: async () => {
      // Import dataStore to access interviews
      const { dataStore } = await import('../lib/dataStore')

      // Find active interview for this candidate
      const interview = Array.from(dataStore.interviews.values()).find(
        (i: any) => i.candidateId === ctx.candidate.id && i.status === 'scheduled'
      )

      if (!interview) {
        return `No scheduled interview found for ${ctx.candidate.name}.`
      }

      // Cancel interview
      interview.status = 'cancelled'

      // Free up the slot
      freeSlot(interview.slotId)

      // Update candidate
      ctx.candidate.currentFlow = 'completed'
      updateCandidate(ctx.candidate)

      // Save data
      await saveData()

      return `Interview for ${ctx.candidate.name} has been cancelled successfully.`
    },
  })
}
