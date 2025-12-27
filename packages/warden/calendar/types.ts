export interface TimeSlot {
  start: Date
  end: Date
}

export interface Appointment {
  id: string
  start: Date
  end: Date
  customerName: string
  customerPhone: string
  serviceName?: string
}

export interface CalendarAdapter {
  /**
   * Check available time slots between two dates
   */
  checkAvailability(startDate: Date, endDate: Date): Promise<TimeSlot[]>

  /**
   * Book an appointment for a customer
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
