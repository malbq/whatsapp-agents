import { tool } from 'ai'
import { z } from 'zod'
import type { FrmToolContext, ReminderTimer } from '../types'

export function createRescheduleInterviewTool(ctx: FrmToolContext) {
  return tool({
    name: 'reschedule_interview',
    description: 'Reschedule an existing interview to a new date and time.',
    inputSchema: z.object({
      candidateName: z.string().describe('Name of the candidate'),
      newDate: z.string().describe('New date in YYYY-MM-DD format'),
      newTime: z.string().describe('New time in HH:MM format'),
    }),
    execute: async ({ candidateName, newDate, newTime }) => {
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

      // Check if new slot is available
      const newSlot = ctx.dataStore.availableSlots.find(
        (slot) => slot.date === newDate && slot.time === newTime && slot.available
      )

      if (!newSlot) {
        return `Cannot reschedule: the new slot ${newDate} at ${newTime} is not available.`
      }

      // Free up old slot
      const oldSlot = ctx.dataStore.availableSlots.find((s) => s.id === interview.slotId)
      if (oldSlot) {
        oldSlot.available = true
        oldSlot.candidateId = undefined
      }

      // Update interview
      interview.slotId = newSlot.id
      interview.scheduledAt = new Date(`${newDate}T${newTime}`)

      // Mark new slot as unavailable
      newSlot.available = false
      newSlot.candidateId = candidate.id

      // Update or create new timer
      const existingTimer = Array.from(ctx.dataStore.timers.values()).find(
        (t) => t.interviewId === interview.id && !t.sent
      )

      if (existingTimer) {
        // Update existing timer
        const reminderTime = new Date(interview.scheduledAt)
        reminderTime.setHours(reminderTime.getHours() - 24)
        existingTimer.dueAt = reminderTime
        existingTimer.sent = false
      } else {
        // Create new timer
        const reminderTime = new Date(interview.scheduledAt)
        reminderTime.setHours(reminderTime.getHours() - 24)

        const timer: ReminderTimer = {
          id: `timer_${Date.now()}`,
          interviewId: interview.id,
          dueAt: reminderTime,
          message: `Lembrete: Você tem uma entrevista reagendada para amanhã às ${newTime} com ${candidateName}.`,
          sent: false,
        }

        ctx.dataStore.timers.set(timer.id, timer)
      }

      // Save data
      await ctx.saveData()

      return `Interview for ${candidateName} has been rescheduled to ${newDate} at ${newTime}. A reminder will be sent 24 hours before the new time.`
    },
  })
}
