import { describe, expect, test } from 'bun:test'
import { getMessageTypeFromMimeType } from './getMessageTypeFromMimeType'

describe('getMessageTypeFromMimeType', () => {
  describe('image types', () => {
    test('returns image for jpeg', () => {
      expect(getMessageTypeFromMimeType('image/jpeg')).toBe('image')
    })

    test('returns image for jpg', () => {
      expect(getMessageTypeFromMimeType('image/jpg')).toBe('image')
    })

    test('returns image for png', () => {
      expect(getMessageTypeFromMimeType('image/png')).toBe('image')
    })

    test('returns image for gif', () => {
      expect(getMessageTypeFromMimeType('image/gif')).toBe('image')
    })

    test('returns image for webp', () => {
      expect(getMessageTypeFromMimeType('image/webp')).toBe('image')
    })

    test('returns image for bmp', () => {
      expect(getMessageTypeFromMimeType('image/bmp')).toBe('image')
    })

    test('returns image for tiff', () => {
      expect(getMessageTypeFromMimeType('image/tiff')).toBe('image')
    })
  })

  describe('document types', () => {
    test('returns document for pdf', () => {
      expect(getMessageTypeFromMimeType('application/pdf')).toBe('document')
    })

    test('returns document for doc', () => {
      expect(getMessageTypeFromMimeType('application/msword')).toBe('document')
    })

    test('returns document for docx', () => {
      expect(
        getMessageTypeFromMimeType(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
      ).toBe('document')
    })

    test('returns document for xls', () => {
      expect(getMessageTypeFromMimeType('application/vnd.ms-excel')).toBe('document')
    })

    test('returns document for xlsx', () => {
      expect(
        getMessageTypeFromMimeType(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
      ).toBe('document')
    })

    test('returns document for ppt', () => {
      expect(getMessageTypeFromMimeType('application/vnd.ms-powerpoint')).toBe('document')
    })

    test('returns document for pptx', () => {
      expect(
        getMessageTypeFromMimeType(
          'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        )
      ).toBe('document')
    })

    test('returns document for plain text', () => {
      expect(getMessageTypeFromMimeType('text/plain')).toBe('document')
    })

    test('returns document for csv', () => {
      expect(getMessageTypeFromMimeType('text/csv')).toBe('document')
    })
  })

  describe('unsupported types', () => {
    test('returns undefined for audio', () => {
      expect(getMessageTypeFromMimeType('audio/mp3')).toBeUndefined()
    })

    test('returns undefined for video', () => {
      expect(getMessageTypeFromMimeType('video/mp4')).toBeUndefined()
    })

    test('returns undefined for unknown type', () => {
      expect(getMessageTypeFromMimeType('application/unknown')).toBeUndefined()
    })

    test('returns undefined for empty mime type', () => {
      expect(getMessageTypeFromMimeType('')).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    test('handles mime type with parameters', () => {
      expect(getMessageTypeFromMimeType('image/jpeg; charset=utf-8')).toBe('image')
    })

    test('handles uppercase mime type', () => {
      expect(getMessageTypeFromMimeType('IMAGE/PNG')).toBe('image')
    })

    test('handles mime type with whitespace', () => {
      expect(getMessageTypeFromMimeType('  application/pdf  ')).toBe('document')
    })

    test('handles mime type with multiple parameters', () => {
      expect(getMessageTypeFromMimeType('text/plain; charset=utf-8; format=flowed')).toBe(
        'document'
      )
    })
  })
})
