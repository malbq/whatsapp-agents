import { google } from 'googleapis'
import type { WardenDB } from '../db'
import {
  CalendarNotConnectedError,
  SlotUnavailableError,
  type Appointment,
  type AvailabilityResult,
  type BusyInterval,
  type CalendarAdapter,
  type CheckAvailabilityOptions,
  type TimeSlot,
} from './types'

function getOAuth2Client() {
  return new google.auth.OAuth2(
    import.meta.env.GOOGLE_CLIENT_ID,
    import.meta.env.GOOGLE_CLIENT_SECRET
  )
}

/**
 * Creates a calendar adapter that loads credentials from the database.
 * Each call to a method will fetch the current connection from DB.
 * This ensures we always use the latest credentials and handles disconnection gracefully.
 *
 * The calendar ID for appointments is now read from calendar_settings table,
 * falling back to the connection table for backwards compatibility.
 */
export function createCalendarAdapter(db: WardenDB): CalendarAdapter {
  async function getCalendarClient() {
    const connection = await db.getCalendarConnection()
    if (!connection) {
      throw new CalendarNotConnectedError()
    }

    const oauth2Client = getOAuth2Client()
    oauth2Client.setCredentials({ refresh_token: connection.refreshToken })

    // Get appointment calendar from settings, fallback to connection table
    const appointmentCalendarId = await db.getAppointmentCalendarId()
    const calendarId = appointmentCalendarId ?? connection.calendarId

    return {
      calendar: google.calendar({ version: 'v3', auth: oauth2Client }),
      calendarId,
    }
  }

  return createCalendarAdapterFromGetter(getCalendarClient)
}

type CalendarClient = {
  calendar: ReturnType<typeof google.calendar>
  calendarId: string
}

/**
 * Parse a time string (HH:MM) into hours and minutes.
 */
function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number)
  return { hours: hours!, minutes: minutes! }
}

/**
 * Get the date string (YYYY-MM-DD) for a Date in a specific timezone.
 */
function getDateStringInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date) // Returns YYYY-MM-DD
}

/**
 * Create a Date from a date string and time in a specific timezone.
 * This properly handles timezone conversion so that "08:00" in America/Sao_Paulo
 * becomes the correct UTC timestamp.
 */
function createDateInTimezone(dateStr: string, hours: number, minutes: number, timezone: string): Date {
  // Build a locale string representation of the target time
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
  const targetTimeStr = `${dateStr} ${timeStr}`
  
  // Create a reference point and use the timezone offset difference
  // We parse as if it's a local time, then calculate the actual UTC time
  const [year, month, day] = dateStr.split('-').map(Number)
  
  // Create a date at midnight UTC on the target date
  const midnightUTC = Date.UTC(year!, month! - 1, day!, 0, 0, 0)
  
  // Calculate what time it is in the target timezone at midnight UTC
  const atMidnightUTC = new Date(midnightUTC)
  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })
  const tzAtMidnight = tzFormatter.format(atMidnightUTC)
  const [tzHour, tzMin] = tzAtMidnight.split(':').map(Number)
  
  // The offset is how many minutes the timezone is ahead of UTC
  // If at midnight UTC the timezone shows 21:00 (previous day), offset is -180 minutes
  // If at midnight UTC the timezone shows 03:00 (same day), offset is +180 minutes
  let offsetMinutes = (tzHour! * 60 + tzMin!)
  if (offsetMinutes > 12 * 60) {
    // If it shows e.g., 21:00, that means it's still the previous day
    offsetMinutes = offsetMinutes - 24 * 60
  }
  
  // The target time in UTC = target local time - offset
  const targetMs = midnightUTC + (hours * 60 + minutes) * 60 * 1000 - offsetMinutes * 60 * 1000
  
  return new Date(targetMs)
}

/**
 * Get working hour intervals for a specific date.
 */
function getWorkingIntervalsForDate(
  date: Date,
  workingHours: CheckAvailabilityOptions['workingHours'],
  timezone: string
): TimeSlot[] {
  const dayOfWeek = getDayOfWeekInTimezone(date, timezone)
  const dayEntries = workingHours.filter((wh) => wh.dayOfWeek === dayOfWeek)

  if (dayEntries.length === 0) return []

  // Get the date string in the target timezone
  const dateStr = getDateStringInTimezone(date, timezone)

  const intervals: TimeSlot[] = []
  for (const entry of dayEntries) {
    const start = parseTime(entry.startTime)
    const end = parseTime(entry.endTime)

    const startDate = createDateInTimezone(dateStr, start.hours, start.minutes, timezone)
    const endDate = createDateInTimezone(dateStr, end.hours, end.minutes, timezone)

    intervals.push({ start: startDate, end: endDate })
  }

  return intervals.toSorted((a, b) => a.start.getTime() - b.start.getTime())
}

/**
 * Get day of week in a specific timezone.
 */
function getDayOfWeekInTimezone(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  })
  const dayStr = formatter.format(date)
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }
  return dayMap[dayStr] ?? 0
}

/**
 * Check if two time ranges overlap.
 */
function rangesOverlap(a: TimeSlot, b: TimeSlot): boolean {
  return a.start < b.end && a.end > b.start
}

/**
 * Generate available slots for a date range.
 */
function generateSlots(options: CheckAvailabilityOptions, busyIntervals: BusyInterval[]): TimeSlot[] {
  const {
    startDate,
    endDate,
    durationMinutes,
    settings,
    workingHours,
    appointmentCalendarId,
    timezone,
    excludeWindow,
  } = options

  const { bufferMinutes, minNoticeMinutes, granularityMinutes } = settings
  const now = new Date()
  const minNoticeTime = new Date(now.getTime() + minNoticeMinutes * 60 * 1000)

  const slots: TimeSlot[] = []
  
  // Get start and end dates in the calendar's timezone
  const startDateStr = getDateStringInTimezone(startDate, timezone)
  const endDateStr = getDateStringInTimezone(endDate, timezone)
  
  // Iterate by date string to ensure we cover the correct days in the target timezone
  let currentDateStr = startDateStr
  
  while (currentDateStr <= endDateStr) {
    // Create a Date object for midnight on this day in the target timezone
    const [year, month, day] = currentDateStr.split('-').map(Number)
    const currentDate = createDateInTimezone(currentDateStr, 0, 0, timezone)
    
    const workingIntervals = getWorkingIntervalsForDate(currentDate, workingHours, timezone)

    for (const interval of workingIntervals) {
      // Align start to granularity grid
      let slotStart = new Date(interval.start)

      // Buffers are "clipped" at the start/end of working intervals
      // So if open at 09:00 with 30m buffer, 09:00 is valid (pre-buffer clipped)

      while (slotStart < interval.end) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000)

        // Check if slot end exceeds working interval
        if (slotEnd > interval.end) break

        // Check minimum notice
        if (slotStart < minNoticeTime) {
          slotStart = new Date(slotStart.getTime() + granularityMinutes * 60 * 1000)
          continue
        }

        // Calculate buffered slot for collision detection with appointment calendar
        // Buffer is symmetric but clipped at working interval boundaries
        const bufferedStart = new Date(
          Math.max(slotStart.getTime() - bufferMinutes * 60 * 1000, interval.start.getTime())
        )
        const bufferedEnd = new Date(
          Math.min(slotEnd.getTime() + bufferMinutes * 60 * 1000, interval.end.getTime())
        )

        // Check for conflicts with busy intervals
        let isAvailable = true
        for (const busy of busyIntervals) {
          // Skip excluded window (for rescheduling)
          if (
            excludeWindow &&
            busy.start.getTime() === excludeWindow.start.getTime() &&
            busy.end.getTime() === excludeWindow.end.getTime()
          ) {
            continue
          }

          // For appointment calendar, check buffered slot
          // For other calendars, check the actual slot
          const slotToCheck =
            busy.calendarId === appointmentCalendarId
              ? { start: bufferedStart, end: bufferedEnd }
              : { start: slotStart, end: slotEnd }

          if (rangesOverlap(slotToCheck, busy)) {
            isAvailable = false
            break
          }
        }

        if (isAvailable) {
          slots.push({ start: new Date(slotStart), end: new Date(slotEnd) })
        }

        // Move to next slot based on granularity
        slotStart = new Date(slotStart.getTime() + granularityMinutes * 60 * 1000)
      }
    }

    // Move to next day by incrementing the date string
    const nextDate = new Date(Date.UTC(year!, month! - 1, day! + 1))
    currentDateStr = nextDate.toISOString().slice(0, 10)
  }

  return slots
}

function createCalendarAdapterFromGetter(
  getCalendarClient: () => Promise<CalendarClient>
): CalendarAdapter {
  return {
    async checkAvailability(options: CheckAvailabilityOptions): Promise<AvailabilityResult> {
      const { calendar } = await getCalendarClient()
      const { startDate, endDate, busyCalendarIds, timezone } = options

      if (busyCalendarIds.length === 0) {
        return { slots: [], timezone }
      }

      // Query FreeBusy for all enabled calendars
      const freeBusyResponse = await calendar.freebusy.query({
        requestBody: {
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          items: busyCalendarIds.map((id) => ({ id })),
        },
      })

      const busyIntervals: BusyInterval[] = []
      const calendars = freeBusyResponse.data.calendars ?? {}

      for (const calendarId of busyCalendarIds) {
        const calendarBusy = calendars[calendarId]?.busy ?? []
        // Note: FreeBusy API returns only non-transparent events.
        // The forceBusy flag in calendar settings is for documentation intent
        // when subscribing to holiday calendars that may have transparent events.

        for (const busy of calendarBusy) {
          if (busy.start && busy.end) {
            busyIntervals.push({
              start: new Date(busy.start),
              end: new Date(busy.end),
              calendarId,
            })
          }
        }
      }

      const slots = generateSlots(options, busyIntervals)

      return { slots, timezone }
    },

    async verifySlotAvailable(
      slot: TimeSlot,
      busyCalendarIds: string[],
      forceBusyCalendarIds: string[],
      appointmentCalendarId: string,
      bufferMinutes: number
    ): Promise<boolean> {
      const { calendar } = await getCalendarClient()

      if (busyCalendarIds.length === 0) {
        return true
      }

      // Calculate buffered slot for appointment calendar
      const bufferedStart = new Date(slot.start.getTime() - bufferMinutes * 60 * 1000)
      const bufferedEnd = new Date(slot.end.getTime() + bufferMinutes * 60 * 1000)

      // Check FreeBusy for the buffered time range
      const freeBusyResponse = await calendar.freebusy.query({
        requestBody: {
          timeMin: bufferedStart.toISOString(),
          timeMax: bufferedEnd.toISOString(),
          items: busyCalendarIds.map((id) => ({ id })),
        },
      })

      const calendars = freeBusyResponse.data.calendars ?? {}

      for (const calendarId of busyCalendarIds) {
        const calendarBusy = calendars[calendarId]?.busy ?? []

        for (const busy of calendarBusy) {
          if (!busy.start || !busy.end) continue

          const busySlot = {
            start: new Date(busy.start),
            end: new Date(busy.end),
          }

          // For appointment calendar, use buffered slot
          // For other calendars, use actual slot
          const slotToCheck =
            calendarId === appointmentCalendarId
              ? { start: bufferedStart, end: bufferedEnd }
              : slot

          if (rangesOverlap(slotToCheck, busySlot)) {
            return false
          }
        }
      }

      return true
    },

    async bookAppointment(
      slot: TimeSlot,
      customerName: string,
      customerPhone: string,
      serviceName?: string
    ): Promise<Appointment> {
      const { calendar, calendarId } = await getCalendarClient()

      const summary = serviceName
        ? `${serviceName} - ${customerName}`
        : `Agendamento - ${customerName}`

      const event = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary,
          description: `Cliente: ${customerName}\nTelefone: ${customerPhone}`,
          start: {
            dateTime: slot.start.toISOString(),
          },
          end: {
            dateTime: slot.end.toISOString(),
          },
        },
      })

      return {
        id: event.data.id!,
        start: new Date(event.data.start!.dateTime!),
        end: new Date(event.data.end!.dateTime!),
        customerName,
        customerPhone,
        serviceName,
      }
    },

    async cancelAppointment(appointmentId: string): Promise<void> {
      const { calendar, calendarId } = await getCalendarClient()

      await calendar.events.delete({
        calendarId,
        eventId: appointmentId,
      })
    },

    async getAppointment(appointmentId: string): Promise<Appointment | null> {
      const { calendar, calendarId } = await getCalendarClient()

      const event = await calendar.events
        .get({
          calendarId,
          eventId: appointmentId,
        })
        .catch(() => null)

      if (!event) return null

      // Parse customer info from description
      const descriptionLines = event.data.description?.split('\n') ?? []
      const customerName =
        descriptionLines
          .find((l) => l.startsWith('Cliente:'))
          ?.replace('Cliente:', '')
          .trim() ??
        event.data.summary ??
        'Unknown'
      const customerPhone =
        descriptionLines
          .find((l) => l.startsWith('Telefone:'))
          ?.replace('Telefone:', '')
          .trim() ?? ''

      return {
        id: event.data.id!,
        start: new Date(event.data.start!.dateTime!),
        end: new Date(event.data.end!.dateTime!),
        customerName,
        customerPhone,
      }
    },

    async updateAppointment(appointmentId: string, newSlot: TimeSlot): Promise<Appointment> {
      const { calendar, calendarId } = await getCalendarClient()

      const event = await calendar.events.patch({
        calendarId,
        eventId: appointmentId,
        requestBody: {
          start: { dateTime: newSlot.start.toISOString() },
          end: { dateTime: newSlot.end.toISOString() },
        },
      })

      const descriptionLines = event.data.description?.split('\n') ?? []
      const customerName =
        descriptionLines
          .find((l) => l.startsWith('Cliente:'))
          ?.replace('Cliente:', '')
          .trim() ??
        event.data.summary ??
        'Unknown'
      const customerPhone =
        descriptionLines
          .find((l) => l.startsWith('Telefone:'))
          ?.replace('Telefone:', '')
          .trim() ?? ''

      return {
        id: event.data.id!,
        start: new Date(event.data.start!.dateTime!),
        end: new Date(event.data.end!.dateTime!),
        customerName,
        customerPhone,
      }
    },

    async getCalendarTimezone(): Promise<string> {
      const { calendar, calendarId } = await getCalendarClient()

      const calendarData = await calendar.calendars.get({
        calendarId,
      })

      // Default to Brazil timezone if not specified
      return calendarData.data.timeZone ?? 'America/Sao_Paulo'
    },
  }
}

export { SlotUnavailableError }
