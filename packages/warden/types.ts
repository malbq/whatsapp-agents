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
  deletedAt?: Date
}

export interface CustomerAppointment {
  id: string
  calendarEventId: string
  userId: string
  serviceId?: string
  scheduledAt: Date
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed'
}

export interface AppointmentWithCustomer extends CustomerAppointment {
  customerName: string
  customerPhone: string
  serviceName?: string
}

export interface CalendarSettingsEntry {
  calendarId: string
  isAppointmentCalendar: boolean
  enabled: boolean
  displayOrder: number
  forceBusy: boolean
}

/**
 * Working hours interval for a specific day of the week.
 */
export interface WorkingHoursEntry {
  id: string
  /** Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday */
  dayOfWeek: number
  /** Start time in HH:MM format (24h) */
  startTime: string
  /** End time in HH:MM format (24h) */
  endTime: string
}

/**
 * Availability settings for scheduling appointments.
 */
export interface AvailabilitySettings {
  /** Buffer time in minutes before and after appointments (symmetric) */
  bufferMinutes: number
  /** Minimum notice in minutes required for creating new appointments */
  minNoticeMinutes: number
  /** Minimum notice in minutes required for rescheduling appointments */
  minRescheduleNoticeMinutes: number
  /** Slot granularity in minutes (step size for available slots) */
  granularityMinutes: number
  /** Maximum days ahead to show availability */
  maxDaysAhead: number
}
