import type { Chat } from '@batman/whatsapp'
import type { Tool } from 'ai'
import type { Candidate } from '../types'
import { createCancelInterviewTool } from './cancelInterview'
import createConsultScheduleTool from './consultSchedule'
import { createRescheduleInterviewTool } from './rescheduleInterview'
import { createScheduleInterviewTool } from './scheduleInterview'

export interface FrmToolContext {
  userWhatsappId: string
  chat: Chat
  candidate: Candidate
}

export function createTools(context: FrmToolContext): Tool[] {
  return [
    createConsultScheduleTool(),
    createScheduleInterviewTool(context),
    createCancelInterviewTool(context),
    createRescheduleInterviewTool(context),
  ]
}
