import { readFile, writeFile } from 'node:fs/promises'
import type { CompanyInfo, FrmDataStore, InterviewSlot } from './types'

// Default company information
const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: 'TechCorp',
  location: 'São Paulo, SP',
  contact: 'contato@techcorp.com.br',
}

// Generate initial available slots for the next 30 days
function generateInitialSlots(): InterviewSlot[] {
  const slots: InterviewSlot[] = []
  const now = new Date()
  let id = 1

  for (let day = 0; day < 30; day++) {
    const date = new Date(now)
    date.setDate(now.getDate() + day)

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue

    // Add slots from 9:00 to 17:00 every hour
    for (let hour = 9; hour <= 17; hour++) {
      const timeStr = `${hour.toString().padStart(2, '0')}:00`
      const dateStr = date.toISOString().split('T')[0] || date.toISOString()
      slots.push({
        id: `slot_${id++}`,
        date: dateStr,
        time: timeStr,
        available: true,
      })
    }
  }

  return slots
}

// Data persistence file path
const DATA_FILE = 'frm_data.json'

// Serialize data for JSON storage
function serializeData(data: FrmDataStore): any {
  return {
    companyInfo: data.companyInfo,
    interviews: Array.from(data.interviews.entries()),
    candidates: Array.from(data.candidates.entries()),
    availableSlots: data.availableSlots,
    timers: Array.from(data.timers.entries()),
  }
}

// Deserialize data from JSON storage
function deserializeData(data: any): FrmDataStore {
  return {
    companyInfo: data.companyInfo || DEFAULT_COMPANY_INFO,
    interviews: new Map(data.interviews || []),
    candidates: new Map(data.candidates || []),
    availableSlots: data.availableSlots || generateInitialSlots(),
    timers: new Map(data.timers || []),
  }
}

// Initialize data store
export async function initializeDataStore(): Promise<{
  dataStore: FrmDataStore
  saveData: () => Promise<void>
}> {
  let dataStore: FrmDataStore

  try {
    // Try to load existing data
    const fileContent = await readFile(DATA_FILE, 'utf8')
    const parsedData = JSON.parse(fileContent)
    dataStore = deserializeData(parsedData)
  } catch {
    // Initialize with default data
    dataStore = {
      companyInfo: DEFAULT_COMPANY_INFO,
      interviews: new Map(),
      candidates: new Map(),
      availableSlots: generateInitialSlots(),
      timers: new Map(),
    }
  }

  // Save function
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
