export interface CalendarListItem {
  id: string
  summary: string
  primary?: boolean
  backgroundColor?: string
}

export interface SidebarCalendar extends CalendarListItem {
  enabled: boolean
}

export interface CalendarEvent {
  id: string
  calendarId: string
  summary?: string
  start?: { dateTime?: string | null; date?: string | null }
  end?: { dateTime?: string | null; date?: string | null }
  backgroundColor?: string
  isAppointmentCalendar?: boolean
}

export interface CalendarData {
  connected: true
  calendars: SidebarCalendar[]
  appointmentCalendarId: string | null
  enabledCalendarIds: string[]
  events: CalendarEvent[]
  currentMonth: string
}

export interface CalendarDisconnected {
  connected: false
}

export type CalendarResponse = CalendarData | CalendarDisconnected
