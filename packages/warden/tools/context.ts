import type { CalendarAdapter } from '../calendar/types'
import type { WardenDB } from '../db'

export interface ToolContext {
  userId: string
  userName: string
  userPhone: string
  calendar: CalendarAdapter
  db: WardenDB
}
