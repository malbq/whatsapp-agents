import { tool } from 'ai'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { FrmToolContext, Interview, ReminderTimer } from '../types'

export function createScheduleInterviewTool(ctx: FrmToolContext) {
  return tool({
    name: 'schedule_interview',
    description: 'Schedule an interview for a candidate at a specific date and time.',
    inputSchema: z.object({
      candidateName: z.string().describe('Name of the candidate'),
      date: z.string().describe('Date in YYYY-MM-DD format'),
      time: z.string().describe('Time in HH:MM format'),
    }),
    execute: async ({ candidateName, date, time }) => {
      // Find available slot
      const slotIndex = ctx.dataStore.availableSlots.findIndex(
        (slot) => slot.date === date && slot.time === time && slot.available
      )

      if (slotIndex === -1) {
        return `Cannot schedule interview: slot ${date} at ${time} is not available.`
      }

      // Get or create candidate
      let candidate = Array.from(ctx.dataStore.candidates.values()).find(
        (c) => c.name.toLowerCase() === candidateName.toLowerCase()
      )

      if (!candidate) {
        candidate = {
          id: randomUUID(),
          name: candidateName,
          externalId: ctx.userWhatsappId,
          status: 'interviewing',
          interviews: [],
        }
        ctx.dataStore.candidates.set(candidate.id, candidate)
      } else {
        candidate.status = 'interviewing'
      }

      // Create interview
      const slot = ctx.dataStore.availableSlots[slotIndex]
      const interview: Interview = {
        id: randomUUID(),
        candidateId: candidate!.id,
        candidateName: candidate!.name,
        slotId: slot!.id,
        status: 'scheduled',
        scheduledAt: new Date(`${date}T${time}`),
      }

      ctx.dataStore.interviews.set(interview.id, interview)

      // Mark slot as unavailable
      slot!.available = false
      slot!.candidateId = candidate!.id

      // Add interview to candidate
      candidate!.interviews.push(interview.id)

      // Create reminder timer (24 hours before interview)
      const reminderTime = new Date(interview.scheduledAt)
      reminderTime.setHours(reminderTime.getHours() - 24)

      const timer: ReminderTimer = {
        id: randomUUID(),
        interviewId: interview.id,
        dueAt: reminderTime,
        message: `Lembrete: Você tem uma entrevista agendada amanhã às ${time} com ${candidateName}.`,
        sent: false,
      }

      ctx.dataStore.timers.set(timer.id, timer)

      // Save data
      await ctx.saveData()

      return `Interview scheduled successfully for ${candidateName} on ${date} at ${time}. A reminder will be sent 24 hours before the interview.`
    },
  })
}
