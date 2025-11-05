import { readFile, writeFile } from 'node:fs/promises'
import type { Candidate, CompanyInfo, Interview, InterviewSlot } from '../types'

export interface FrmDataStore {
  companyInfo: CompanyInfo
  interviews: Map<string, Interview>
  candidates: Map<string, Candidate>
  availableSlots: InterviewSlot[]
}

const DATA_FILE = './storage/frm_data.json'

const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: 'TechCorp',
  location: 'São Paulo, SP',
  contact: 'contato@techcorp.com.br',
}

function serializeData(data: FrmDataStore): any {
  return {
    companyInfo: data.companyInfo,
    interviews: Array.from(data.interviews.values()),
    candidates: Array.from(data.candidates.values()),
    availableSlots: data.availableSlots,
  }
}

function deserializeData(data: any): FrmDataStore {
  const interviewsList = data.interviews || []
  const interviews = new Map<string, Interview>()
  
  // Convert array to Map and convert scheduledAt strings back to Date objects
  for (const interview of interviewsList) {
    if (interview.scheduledAt && typeof interview.scheduledAt === 'string') {
      interview.scheduledAt = new Date(interview.scheduledAt)
    }
    interviews.set(interview.id, interview)
  }

  const candidatesList = data.candidates || []
  const candidates = new Map<string, Candidate>()
  
  // Convert array to Map
  for (const candidate of candidatesList) {
    candidates.set(candidate.id, candidate)
  }

  return {
    companyInfo: data.companyInfo || DEFAULT_COMPANY_INFO,
    interviews,
    candidates,
    availableSlots: data.availableSlots || [],
  }
}

export async function initializeDataStore(): Promise<{
  dataStore: FrmDataStore
  saveData: () => Promise<void>
}> {
  let dataStore: FrmDataStore

  try {
    const fileContent = await readFile(DATA_FILE, 'utf8')
    const parsedData = JSON.parse(fileContent)
    dataStore = deserializeData(parsedData)
  } catch {
    throw new Error('Failed to load FRM data. Ensure frm_data.json exists in ./storage/')
  }

  const saveData = async (): Promise<void> => {
    try {
      const serialized = serializeData(dataStore)
      await writeFile(DATA_FILE, JSON.stringify(serialized, null, 2))
    } catch (error) {
      console.error('Failed to save FRM data:', error)
    }
  }

  return { dataStore, saveData }
}

export const { dataStore, saveData } = await initializeDataStore()

export function findCandidateByPhone(phone: string): Candidate | undefined {
  for (const [_, candidate] of dataStore.candidates) {
    if (candidate.phone === phone) {
      return candidate
    }
  }
  return undefined
}

export function updateCandidate(candidate: Candidate): void {
  dataStore.candidates.set(candidate.id, candidate)
}

export function getAvailableSlots(): InterviewSlot[] {
  return dataStore.availableSlots.filter((slot) => slot.available)
}

export function findSlotByDateTime(date: string, time: string): InterviewSlot | undefined {
  return dataStore.availableSlots.find((s) => s.date === date && s.time === time)
}

export function findSlotByCandidateId(candidateId: string): InterviewSlot | undefined {
  return dataStore.availableSlots.find((s) => s.candidateId === candidateId && !s.available)
}

export function bookSlotByDateTime(
  date: string,
  time: string,
  candidateId: string
): InterviewSlot | undefined {
  const slot = dataStore.availableSlots.find(
    (s) => s.date === date && s.time === time && s.available
  )
  if (slot) {
    slot.available = false
    slot.candidateId = candidateId
  }
  return slot
}

export function freeSlot(slotId: string): void {
  const slot = dataStore.availableSlots.find((s) => s.id === slotId)
  if (slot) {
    slot.available = true
    delete slot.candidateId
  }
}
