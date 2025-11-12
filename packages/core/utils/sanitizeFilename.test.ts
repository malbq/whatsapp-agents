import { describe, expect, test } from 'bun:test'
import { sanitizeFilename } from './sanitizeFilename'

describe('sanitizeFilename', () => {
  test('removes special characters', () => {
    const result = sanitizeFilename('file<>name:"with|special*.chars')
    expect(result).toBe('file_name_with_special_.chars')
  })

  test('replaces spaces with underscores', () => {
    const result = sanitizeFilename('my document file.pdf')
    expect(result).toBe('my_document_file.pdf')
  })

  test('collapses multiple spaces', () => {
    const result = sanitizeFilename('file    with    spaces.txt')
    expect(result).toBe('file_with_spaces.txt')
  })

  test('collapses multiple underscores', () => {
    const result = sanitizeFilename('file___name.txt')
    expect(result).toBe('file_name.txt')
  })

  test('trims leading and trailing underscores', () => {
    const result = sanitizeFilename('___filename___.txt')
    expect(result).toBe('filename_.txt')
  })

  test('truncates to 40 characters', () => {
    const longFilename = 'a'.repeat(100) + '.txt'
    const result = sanitizeFilename(longFilename)
    expect(result.length).toBe(40)
  })

  test('handles forward slashes', () => {
    const result = sanitizeFilename('path/to/file.txt')
    expect(result).toBe('path_to_file.txt')
  })

  test('handles backslashes', () => {
    const result = sanitizeFilename('path\\to\\file.txt')
    expect(result).toBe('path_to_file.txt')
  })

  test('handles question marks and asterisks', () => {
    const result = sanitizeFilename('file?.txt*')
    expect(result).toBe('file_.txt')
  })

  test('preserves normal filenames', () => {
    const result = sanitizeFilename('normal_file-123.pdf')
    expect(result).toBe('normal_file-123.pdf')
  })

  test('handles empty string', () => {
    const result = sanitizeFilename('')
    expect(result).toBe('')
  })

  test('handles all special characters', () => {
    const result = sanitizeFilename('<>:"/\\|?*')
    expect(result).toBe('')
  })

  test('truncates long filename to 40 characters', () => {
    const longFilename = 'a'.repeat(50) + '.pdf'
    const result = sanitizeFilename(longFilename)
    expect(result.length).toBe(40)
    // Note: extension may be truncated if filename is too long
    expect(result.startsWith('aaa')).toBe(true)
  })
})
