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
  result?: 'approved' | 'rejected'
  resultProcessedAt?: Date
}

export interface Candidate {
  id: string
  name: string
  phone: string
  position: string
  currentFlow?: 'initial' | 'scheduling' | 'rescheduling' | 'completed'
}
