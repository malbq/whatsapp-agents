/**
 * Options for parsing a date string into a Date object.
 */
export interface ParseDateOptions {
  /** Date string in YYYY-MM-DD format, or ISO datetime string */
  date: string
  /** Hour of day (0-23). Defaults to 0. */
  hour?: number
  /** Minute (0-59). Defaults to 0. */
  minute?: number
  /** IANA timezone (e.g., 'America/Sao_Paulo'). If omitted, uses local timezone. */
  timezone?: string
}

/**
 * Parse a date string into a Date object, with timezone-aware handling.
 *
 * Handles two formats:
 * - ISO datetime (contains 'T'): parsed directly, timezone info preserved
 * - Date-only (YYYY-MM-DD): interpreted in the specified timezone (or local if omitted)
 *
 * This is important because:
 * - Google Calendar all-day events use date-only format: "2026-01-05"
 * - `new Date("2026-01-05")` interprets this as UTC midnight
 * - In timezones behind UTC (e.g., Americas), UTC midnight becomes the previous day
 * - This function parses date-only strings in the correct timezone to avoid shift
 */
export function parseDate(options: ParseDateOptions): Date
export function parseDate(options: { date: string | null | undefined }): Date | null
export function parseDate(options: ParseDateOptions | { date: string | null | undefined }): Date | null {
  const { date } = options
  if (!date) return null

  // ISO datetime format (e.g., "2026-01-05T14:30:00Z" or "2026-01-05T14:30:00-03:00")
  // These include timezone info, safe to parse directly
  if (date.includes('T')) {
    return new Date(date)
  }

  const hour = 'hour' in options ? (options.hour ?? 0) : 0
  const minute = 'minute' in options ? (options.minute ?? 0) : 0
  const timezone = 'timezone' in options ? options.timezone : undefined

  const [year, month, day] = date.split('-').map(Number)

  // No timezone specified: use local timezone (for UI/browser context)
  if (!timezone) {
    return new Date(year!, month! - 1, day!, hour, minute, 0, 0)
  }

  // Timezone specified: calculate correct UTC timestamp
  // We need to find the UTC offset for the target timezone on the target date
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

  // Calculate offset: how many minutes the timezone is ahead of UTC
  // If at midnight UTC the timezone shows 21:00 (previous day), offset is -180 minutes
  // If at midnight UTC the timezone shows 03:00 (same day), offset is +180 minutes
  let offsetMinutes = tzHour! * 60 + tzMin!
  if (offsetMinutes > 12 * 60) {
    offsetMinutes = offsetMinutes - 24 * 60
  }

  // Target time in UTC = target local time - offset
  const targetMs = midnightUTC + (hour * 60 + minute) * 60 * 1000 - offsetMinutes * 60 * 1000
  return new Date(targetMs)
}
