import { describe, expect, test } from 'bun:test'
import { extractFilename, newStorageKey } from './storageKey'

describe('storageKey', () => {
  describe('newStorageKey', () => {
    test('creates key with filename', () => {
      const key = newStorageKey('uuid-123', 'document.pdf', 'application/pdf')
      expect(key).toBe('uuid-123_document.pdf')
    })

    test('creates key without filename using mimeType', () => {
      const key = newStorageKey('uuid-456', undefined, 'image/jpeg')
      expect(key).toBe('uuid-456.jpg')
    })

    test('sanitizes filename with special characters', () => {
      const key = newStorageKey('uuid-789', 'my file: test?.pdf', 'application/pdf')
      expect(key).toBe('uuid-789_my_file_test_.pdf')
    })

    test('handles long filenames', () => {
      const longFilename = 'a'.repeat(100) + '.pdf'
      const key = newStorageKey('uuid-abc', longFilename, 'application/pdf')
      expect(key.length).toBeLessThan(150)
      expect(key).toContain('uuid-abc_')
    })

    test('handles filename with multiple spaces', () => {
      const key = newStorageKey('uuid-def', 'my    document    .pdf', 'application/pdf')
      expect(key).toBe('uuid-def_my_document_.pdf')
    })
  })

  describe('extractFilename', () => {
    test('extracts filename from storage key with underscore', () => {
      const filename = extractFilename('uuid-123_document.pdf')
      expect(filename).toBe('document.pdf')
    })

    test('extracts filename from path', () => {
      const filename = extractFilename('folder/uuid-456_image.jpg')
      expect(filename).toBe('image.jpg')
    })

    test('returns key without underscore as-is', () => {
      const filename = extractFilename('uuid-789.jpg')
      expect(filename).toBe('uuid-789.jpg')
    })

    test('returns undefined for empty storage key', () => {
      const filename = extractFilename('')
      expect(filename).toBeUndefined()
    })

    test('returns undefined for undefined storage key', () => {
      const filename = extractFilename(undefined)
      expect(filename).toBeUndefined()
    })

    test('handles filename with multiple underscores', () => {
      const filename = extractFilename('uuid-abc_my_long_file_name.pdf')
      expect(filename).toBe('my_long_file_name.pdf')
    })
  })
})
