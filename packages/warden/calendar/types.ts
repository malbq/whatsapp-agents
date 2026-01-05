import type { AvailabilitySettings, WorkingHoursEntry } from '../types'

export interface TimeSlot {
  start: Date
  end: Date
}

/**
 * Busy interval from a calendar.
 */
export interface BusyInterval {
  start: Date
  end: Date
  calendarId: string
}

export interface Appointment {
  id: string
  start: Date
  end: Date
  customerName: string
  customerPhone: string
  serviceName?: string
}

/**
 * Options for checking availability.
 */
export interface CheckAvailabilityOptions {
  /** Start date of the range to check */
  startDate: Date
  /** End date of the range to check */
  endDate: Date
  /** Duration of the appointment in minutes */
  durationMinutes: number
  /** Availability settings (buffer, min notice, granularity) */
  settings: AvailabilitySettings
  /** Working hours configuration */
  workingHours: WorkingHoursEntry[]
  /** Calendar IDs to check for busy times (all enabled calendars) */
  busyCalendarIds: string[]
  /** Calendar IDs that should be treated as force busy (ignore transparency) */
  forceBusyCalendarIds: string[]
  /** Appointment calendar ID (for buffer calculations) */
  appointmentCalendarId: string
  /** Timezone to use for localization (IANA format, e.g., 'America/Sao_Paulo') */
  timezone: string
  /** Exclude this time window from busy times (for rescheduling flows) */
  excludeWindow?: TimeSlot
}

/**
 * Result of checking availability.
 */
export interface AvailabilityResult {
  /** Available time slots */
  slots: TimeSlot[]
  /** Timezone used for the calculation */
  timezone: string
}

/**
 * Error codes for slot booking failures.
 */
export type BookingErrorCode = 'SLOT_UNAVAILABLE' | 'CALENDAR_ERROR'

export interface BookingError {
  code: BookingErrorCode
  message: string
}

export interface CalendarAdapter {
  /**
   * Check available time slots based on configuration.
   */
  checkAvailability(options: CheckAvailabilityOptions): Promise<AvailabilityResult>

  /**
   * Verify that a specific slot is still available.
   * Returns true if available, false otherwise.
   */
  verifySlotAvailable(
    slot: TimeSlot,
    busyCalendarIds: string[],
    forceBusyCalendarIds: string[],
    appointmentCalendarId: string,
    bufferMinutes: number
  ): Promise<boolean>

  /**
   * Book an appointment for a customer.
   * Returns the appointment or throws with BookingError.
   */
  bookAppointment(
    slot: TimeSlot,
    customerName: string,
    customerPhone: string,
    serviceName?: string
  ): Promise<Appointment>

  /**
   * Cancel an existing appointment
   */
  cancelAppointment(appointmentId: string): Promise<void>

  /**
   * Get appointment details by ID
   */
  getAppointment(appointmentId: string): Promise<Appointment | null>

  /**
   * Update an existing appointment to a new time slot
   */
  updateAppointment(appointmentId: string, newSlot: TimeSlot): Promise<Appointment>

  /**
   * Get the timezone of the appointment calendar.
   */
  getCalendarTimezone(): Promise<string>
}

/**
 * Thrown when calendar operations are attempted but no calendar is connected.
 */
export class CalendarNotConnectedError extends Error {
  constructor() {
    super('Calendar not connected')
    this.name = 'CalendarNotConnectedError'
  }
}

/**
 * Thrown when attempting to book a slot that is no longer available.
 */
export class SlotUnavailableError extends Error {
  code: BookingErrorCode = 'SLOT_UNAVAILABLE'

  constructor(message = 'O horário solicitado não está mais disponível.') {
    super(message)
    this.name = 'SlotUnavailableError'
  }
}
