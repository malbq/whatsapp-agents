import { describe, expect, test } from 'bun:test'
import { AISDKError } from 'ai'
import { spreadError } from './spreadError'

describe('spreadError', () => {
  test('spreads AISDKError fields', () => {
    const aiError = new AISDKError({
      message: 'Model request failed',
      cause: new Error('Network timeout'),
      data: { statusCode: 500 },
    })

    const result = spreadError(aiError)

    // AISDKError.isInstance checks, so we get Object.fromEntries(Object.entries(error))
    // This spreads enumerable own properties
    expect(AISDKError.isInstance(aiError)).toBe(true)
    expect(typeof result).toBe('object')
    // The result should be an object with enumerable properties from AISDKError
    expect(Object.keys(result).length).toBeGreaterThan(0)
  })

  test('handles standard Error with message and stack', () => {
    const error = new Error('Something went wrong')

    const result = spreadError(error)

    expect(result).toHaveProperty('error', 'Error: Something went wrong')
    expect(result).toHaveProperty('stack')
    expect(typeof result.stack).toBe('string')
    expect(result.stack).toContain('spreadError.test.ts')
  })

  test('handles string error', () => {
    const error = 'Simple error message'

    const result = spreadError(error)

    expect(result).toEqual({
      error: 'Simple error message',
      stack: undefined,
    })
  })

  test('handles number error', () => {
    const error = 404

    const result = spreadError(error)

    expect(result).toEqual({
      error: '404',
      stack: undefined,
    })
  })

  test('handles null error', () => {
    const error = null

    const result = spreadError(error)

    expect(result).toEqual({
      error: 'null',
      stack: undefined,
    })
  })

  test('handles undefined error', () => {
    const error = undefined

    const result = spreadError(error)

    expect(result).toEqual({
      error: 'undefined',
      stack: undefined,
    })
  })

  test('handles object without Error prototype', () => {
    const error = { message: 'custom error', code: 'ERR_001' }

    const result = spreadError(error)

    expect(result).toEqual({
      error: '[object Object]',
      stack: undefined,
    })
  })

  test('handles custom Error subclass', () => {
    class CustomError extends Error {
      constructor(
        message: string,
        public code: string
      ) {
        super(message)
        this.name = 'CustomError'
      }
    }

    const error = new CustomError('Custom error occurred', 'CUSTOM_001')

    const result = spreadError(error)

    expect(result).toHaveProperty('error')
    expect(result.error).toContain('Custom error occurred')
    expect(result).toHaveProperty('stack')
    expect(typeof result.stack).toBe('string')
  })
})
