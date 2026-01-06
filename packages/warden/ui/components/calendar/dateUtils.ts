import { parseDate } from '../../../lib/dateUtils'

/**
 * Parse a date string, handling all-day events (YYYY-MM-DD format) correctly.
 * All-day dates should be interpreted as local dates, not UTC.
 *
 * @deprecated Use `parseDate` from 'lib/dateUtils' directly instead.
 */
export function parseEventDate(dateStr: string | null | undefined): Date | null {
  return parseDate({ date: dateStr })
}
