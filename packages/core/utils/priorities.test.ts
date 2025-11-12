import { describe, expect, test } from 'bun:test'
import { ASSISTANT_PRIORITY, SYSTEM_PRIORITY, USER_PRIORITY } from './priorities'

describe('priorities', () => {
  test('exports SYSTEM_PRIORITY as 0', () => {
    expect(SYSTEM_PRIORITY).toBe(0)
  })

  test('exports USER_PRIORITY as 1', () => {
    expect(USER_PRIORITY).toBe(1)
  })

  test('exports ASSISTANT_PRIORITY as 2', () => {
    expect(ASSISTANT_PRIORITY).toBe(2)
  })

  test('priorities are in ascending order', () => {
    expect(SYSTEM_PRIORITY).toBeLessThan(USER_PRIORITY)
    expect(USER_PRIORITY).toBeLessThan(ASSISTANT_PRIORITY)
  })

  test('priorities are unique', () => {
    const priorities = [SYSTEM_PRIORITY, USER_PRIORITY, ASSISTANT_PRIORITY]
    const uniquePriorities = new Set(priorities)
    expect(uniquePriorities.size).toBe(3)
  })
})
