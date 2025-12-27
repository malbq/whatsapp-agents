export interface BusinessInfo {
  name: string
  address: string
  contact: string
  description?: string
  /** Operating hours by day of week (0=Sunday, 6=Saturday) */
  operatingHours?: Record<number, { open: string; close: string }>
}

export interface Service {
  id: string
  name: string
  description?: string
  durationMinutes: number
}

export interface CustomerAppointment {
  id: string
  calendarEventId: string
  userId: string
  serviceId?: string
  scheduledAt: Date
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed'
}

export interface CalendarSettingsEntry {
  calendarId: string
  isAppointmentCalendar: boolean
  enabled: boolean
  displayOrder: number
}
