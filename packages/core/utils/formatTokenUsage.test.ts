import { describe, expect, test } from 'bun:test'
import { formatTokenUsage } from './formatTokenUsage'

describe('formatTokenUsage', () => {
  test('formats token usage with all fields', () => {
    const usage = {
      totalTokens: 100,
      inputTokens: 60,
      outputTokens: 40,
    }

    const result = formatTokenUsage(usage)

    expect(result).toEqual({
      total: 100,
      input: 60,
      output: 40,
    })
  })

  test('handles zero tokens', () => {
    const usage = {
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
    }

    const result = formatTokenUsage(usage)

    expect(result).toEqual({
      total: 0,
      input: 0,
      output: 0,
    })
  })

  test('handles large token counts', () => {
    const usage = {
      totalTokens: 1_000_000,
      inputTokens: 900_000,
      outputTokens: 100_000,
    }

    const result = formatTokenUsage(usage)

    expect(result).toEqual({
      total: 1_000_000,
      input: 900_000,
      output: 100_000,
    })
  })
})
