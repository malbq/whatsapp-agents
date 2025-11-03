import type { Chat } from '../../whatsapp/types'

export interface CompanyInfo {
  name: string
  location: string
  contact: string
}

export interface InterviewSlot {
  id: string
  date: string
  time: string
  available: boolean
  candidateId?: string
}

export interface Interview {
  id: string
  candidateId: string
  candidateName: string
  slotId: string
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed'
  scheduledAt: Date
  reminderSentAt?: Date
  result?: 'approved' | 'rejected'
  resultProcessedAt?: Date
}

export interface Candidate {
  id: string
  name: string
  externalId: string
  status: 'prospecting' | 'interviewing' | 'approved' | 'rejected'
  interviews: string[]
}

export interface ReminderTimer {
  id: string
  interviewId: string
  dueAt: Date
  message: string
  sent: boolean
}

export interface FrmDataStore {
  companyInfo: CompanyInfo
  interviews: Map<string, Interview>
  candidates: Map<string, Candidate>
  availableSlots: InterviewSlot[]
  timers: Map<string, ReminderTimer>
}

export interface FrmToolContext {
  userWhatsappId: string
  dataStore: FrmDataStore
  saveData: () => Promise<void>
  chat: Pick<Chat, 'sendText' | 'sendInteractiveButton'>
}
