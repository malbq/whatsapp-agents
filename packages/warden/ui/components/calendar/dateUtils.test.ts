import { describe, expect, test } from 'bun:test'
import { parseEventDate } from './dateUtils'

describe('parseEventDate', () => {
  describe('all-day events (date-only format)', () => {
    test('parses date-only string as local date, not UTC', () => {
      // This is the bug: "2026-01-05" parsed with new Date() becomes UTC midnight,
      // which in timezones behind UTC (e.g., UTC-3) becomes 2026-01-04 21:00 local time
      const result = parseEventDate('2026-01-05')

      expect(result).not.toBeNull()
      expect(result!.getFullYear()).toBe(2026)
      expect(result!.getMonth()).toBe(0) // January is 0
      expect(result!.getDate()).toBe(5) // Should be 5, not 4
    })

    test('returns correct day regardless of timezone offset', () => {
      // Test multiple dates to ensure consistency
      const testCases = [
        { input: '2026-01-01', expectedDay: 1 },
        { input: '2026-06-15', expectedDay: 15 },
        { input: '2026-12-31', expectedDay: 31 },
      ]

      for (const { input, expectedDay } of testCases) {
        const result = parseEventDate(input)
        expect(result!.getDate()).toBe(expectedDay)
      }
    })

    test('returns midnight local time for all-day events', () => {
      const result = parseEventDate('2026-01-05')

      expect(result!.getHours()).toBe(0)
      expect(result!.getMinutes()).toBe(0)
      expect(result!.getSeconds()).toBe(0)
    })
  })

  describe('timed events (dateTime format)', () => {
    test('parses ISO datetime string correctly', () => {
      const result = parseEventDate('2026-01-05T14:30:00-03:00')

      expect(result).not.toBeNull()
      expect(result!.getFullYear()).toBe(2026)
      expect(result!.getMonth()).toBe(0)
      expect(result!.getDate()).toBe(5)
    })

    test('detects dateTime format by presence of T', () => {
      const dateOnly = parseEventDate('2026-01-05')
      const dateTime = parseEventDate('2026-01-05T00:00:00Z')

      // Both should parse to valid dates
      expect(dateOnly).not.toBeNull()
      expect(dateTime).not.toBeNull()

      // Date-only should be local midnight
      expect(dateOnly!.getHours()).toBe(0)
    })
  })

  describe('null/undefined handling', () => {
    test('returns null when input is undefined', () => {
      const result = parseEventDate(undefined)
      expect(result).toBeNull()
    })

    test('returns null when input is null', () => {
      const result = parseEventDate(null)
      expect(result).toBeNull()
    })

    test('returns null when input is empty string', () => {
      const result = parseEventDate('')
      expect(result).toBeNull()
    })
  })
})
