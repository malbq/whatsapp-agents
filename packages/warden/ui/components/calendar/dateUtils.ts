/**
 * Parse a date string, handling all-day events (YYYY-MM-DD format) correctly.
 * All-day dates should be interpreted as local dates, not UTC.
 *
 * This is important because:
 * - Google Calendar all-day events use date-only format: "2026-01-05"
 * - new Date("2026-01-05") interprets this as UTC midnight
 * - In timezones behind UTC (e.g., Americas), UTC midnight becomes the previous day
 * - This function parses date-only strings as local dates to avoid timezone shift
 */
export function parseEventDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) {
    return null
  }
  if (dateStr.includes('T')) {
    // DateTime format (e.g., "2026-01-05T14:30:00Z")
    return new Date(dateStr)
  }
  // Date-only format (e.g., "2026-01-05"): parse as local date to avoid timezone shift
  const parts = dateStr.split('-').map(Number)
  const year = parts[0]!
  const month = parts[1]!
  const day = parts[2]!
  return new Date(year, month - 1, day)
}
