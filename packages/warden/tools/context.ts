import type { CalendarAdapter } from '../calendar/types'
import type { WardenDB } from '../db'

export interface ToolContext {
  userId: string
  userName: string
  userPhone: string
  calendar: CalendarAdapter
  db: WardenDB
}

/**
 * Create a Date from a date string and time in a specific timezone.
 * This properly handles timezone conversion so that "15:00" in America/Sao_Paulo
 * becomes the correct UTC timestamp.
 */
export function createDateInTimezone(
  dateStr: string,
  hours: number,
  minutes: number,
  timezone: string
): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  const midnightUTC = Date.UTC(year!, month! - 1, day!, 0, 0, 0)
  const atMidnightUTC = new Date(midnightUTC)
  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })
  const tzAtMidnight = tzFormatter.format(atMidnightUTC)
  const [tzHour, tzMin] = tzAtMidnight.split(':').map(Number)
  let offsetMinutes = tzHour! * 60 + tzMin!
  if (offsetMinutes > 12 * 60) {
    offsetMinutes = offsetMinutes - 24 * 60
  }
  const targetMs = midnightUTC + (hours * 60 + minutes) * 60 * 1000 - offsetMinutes * 60 * 1000
  return new Date(targetMs)
}
