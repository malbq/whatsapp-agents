import { describe, expect, test } from 'bun:test'
import { parseDate } from '../../../lib/dateUtils'
import { parseEventDate } from './dateUtils'

describe('parseDate', () => {
  describe('all-day events (date-only format)', () => {
    test('parses date-only string as local date, not UTC', () => {
      // This is the bug: "2026-01-05" parsed with new Date() becomes UTC midnight,
      // which in timezones behind UTC (e.g., UTC-3) becomes 2026-01-04 21:00 local time
      const result = parseDate({ date: '2026-01-05' })

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
        const result = parseDate({ date: input })
        expect(result!.getDate()).toBe(expectedDay)
      }
    })

    test('returns midnight local time for all-day events', () => {
      const result = parseDate({ date: '2026-01-05' })

      expect(result!.getHours()).toBe(0)
      expect(result!.getMinutes()).toBe(0)
      expect(result!.getSeconds()).toBe(0)
    })

    test('respects hour and minute parameters', () => {
      const result = parseDate({ date: '2026-01-05', hour: 14, minute: 30 })

      expect(result!.getHours()).toBe(14)
      expect(result!.getMinutes()).toBe(30)
    })
  })

  describe('timezone-aware parsing', () => {
    test('parses date in specified timezone', () => {
      // 9:00 AM in Sao Paulo (UTC-3) should be 12:00 UTC
      const result = parseDate({ date: '2026-01-05', hour: 9, minute: 0, timezone: 'America/Sao_Paulo' })

      expect(result!.getUTCHours()).toBe(12)
      expect(result!.getUTCMinutes()).toBe(0)
    })

    test('parses midnight in specified timezone', () => {
      // Midnight in Sao Paulo (UTC-3) should be 03:00 UTC
      const result = parseDate({ date: '2026-01-05', timezone: 'America/Sao_Paulo' })

      expect(result!.getUTCHours()).toBe(3)
      expect(result!.getUTCMinutes()).toBe(0)
    })

    test('handles positive UTC offset timezone', () => {
      // 9:00 AM in Tokyo (UTC+9) should be 00:00 UTC
      const result = parseDate({ date: '2026-01-05', hour: 9, minute: 0, timezone: 'Asia/Tokyo' })

      expect(result!.getUTCHours()).toBe(0)
      expect(result!.getUTCMinutes()).toBe(0)
    })
  })

  describe('timed events (dateTime format)', () => {
    test('parses ISO datetime string correctly', () => {
      const result = parseDate({ date: '2026-01-05T14:30:00-03:00' })

      expect(result).not.toBeNull()
      expect(result!.getFullYear()).toBe(2026)
      expect(result!.getMonth()).toBe(0)
      expect(result!.getDate()).toBe(5)
    })

    test('detects dateTime format by presence of T', () => {
      const dateOnly = parseDate({ date: '2026-01-05' })
      const dateTime = parseDate({ date: '2026-01-05T00:00:00Z' })

      // Both should parse to valid dates
      expect(dateOnly).not.toBeNull()
      expect(dateTime).not.toBeNull()

      // Date-only should be local midnight
      expect(dateOnly!.getHours()).toBe(0)
    })

    test('ignores hour/minute params for datetime strings', () => {
      // When date contains 'T', hour/minute params should be ignored
      const result = parseDate({ date: '2026-01-05T14:30:00Z', hour: 9, minute: 15 })

      // Should use the time from the string, not the params
      expect(result!.getUTCHours()).toBe(14)
      expect(result!.getUTCMinutes()).toBe(30)
    })
  })

  describe('null/undefined handling', () => {
    test('returns null when input is undefined', () => {
      const result = parseDate({ date: undefined })
      expect(result).toBeNull()
    })

    test('returns null when input is null', () => {
      const result = parseDate({ date: null })
      expect(result).toBeNull()
    })

    test('returns null when input is empty string', () => {
      const result = parseDate({ date: '' })
      expect(result).toBeNull()
    })
  })
})

describe('parseEventDate (deprecated wrapper)', () => {
  test('works as a wrapper around parseDate', () => {
    const result = parseEventDate('2026-01-05')

    expect(result).not.toBeNull()
    expect(result!.getFullYear()).toBe(2026)
    expect(result!.getMonth()).toBe(0)
    expect(result!.getDate()).toBe(5)
  })

  test('returns null for null/undefined', () => {
    expect(parseEventDate(null)).toBeNull()
    expect(parseEventDate(undefined)).toBeNull()
    expect(parseEventDate('')).toBeNull()
  })

  test('handles datetime strings', () => {
    const result = parseEventDate('2026-01-05T14:30:00-03:00')
    expect(result).not.toBeNull()
  })
})
