import { describe, expect, test } from 'bun:test'
import { getExtFromMimeType } from './getExtFromMimeType'

describe('getExtFromMimeType', () => {
  describe('image formats', () => {
    test('handles jpeg', () => {
      expect(getExtFromMimeType('image/jpeg')).toBe('jpg')
    })

    test('handles jpg', () => {
      expect(getExtFromMimeType('image/jpg')).toBe('jpg')
    })

    test('handles png', () => {
      expect(getExtFromMimeType('image/png')).toBe('png')
    })

    test('handles gif', () => {
      expect(getExtFromMimeType('image/gif')).toBe('gif')
    })

    test('handles webp', () => {
      expect(getExtFromMimeType('image/webp')).toBe('webp')
    })

    test('handles bmp', () => {
      expect(getExtFromMimeType('image/bmp')).toBe('bmp')
    })

    test('handles tiff', () => {
      expect(getExtFromMimeType('image/tiff')).toBe('tiff')
    })
  })

  describe('audio formats', () => {
    test('handles ogg', () => {
      expect(getExtFromMimeType('audio/ogg')).toBe('ogg')
    })

    test('handles mpeg', () => {
      expect(getExtFromMimeType('audio/mpeg')).toBe('mp3')
    })

    test('handles mp3', () => {
      expect(getExtFromMimeType('audio/mp3')).toBe('mp3')
    })

    test('handles wav', () => {
      expect(getExtFromMimeType('audio/wav')).toBe('wav')
    })

    test('handles aac', () => {
      expect(getExtFromMimeType('audio/aac')).toBe('aac')
    })

    test('handles m4a', () => {
      expect(getExtFromMimeType('audio/m4a')).toBe('m4a')
    })
  })

  describe('video formats', () => {
    test('handles mp4', () => {
      expect(getExtFromMimeType('video/mp4')).toBe('mp4')
    })

    test('handles avi', () => {
      expect(getExtFromMimeType('video/avi')).toBe('avi')
    })

    test('handles mov', () => {
      expect(getExtFromMimeType('video/mov')).toBe('mov')
    })

    test('handles wmv', () => {
      expect(getExtFromMimeType('video/wmv')).toBe('wmv')
    })
  })

  describe('document formats', () => {
    test('handles pdf', () => {
      expect(getExtFromMimeType('application/pdf')).toBe('pdf')
    })

    test('handles doc', () => {
      expect(getExtFromMimeType('application/msword')).toBe('doc')
    })

    test('handles docx', () => {
      expect(
        getExtFromMimeType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      ).toBe('docx')
    })

    test('handles xls', () => {
      expect(getExtFromMimeType('application/vnd.ms-excel')).toBe('xls')
    })

    test('handles xlsx', () => {
      expect(
        getExtFromMimeType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      ).toBe('xlsx')
    })

    test('handles ppt', () => {
      expect(getExtFromMimeType('application/vnd.ms-powerpoint')).toBe('ppt')
    })

    test('handles pptx', () => {
      expect(
        getExtFromMimeType('application/vnd.openxmlformats-officedocument.presentationml.presentation')
      ).toBe('pptx')
    })

    test('handles txt', () => {
      expect(getExtFromMimeType('text/plain')).toBe('txt')
    })

    test('handles csv', () => {
      expect(getExtFromMimeType('text/csv')).toBe('csv')
    })
  })

  describe('archive formats', () => {
    test('handles zip', () => {
      expect(getExtFromMimeType('application/zip')).toBe('zip')
    })

    test('handles rar', () => {
      expect(getExtFromMimeType('application/x-rar-compressed')).toBe('rar')
    })

    test('handles 7z', () => {
      expect(getExtFromMimeType('application/x-7z-compressed')).toBe('7z')
    })
  })

  describe('edge cases', () => {
    test('handles mime type with parameters', () => {
      expect(getExtFromMimeType('image/jpeg; charset=utf-8')).toBe('jpg')
    })

    test('handles uppercase mime type', () => {
      expect(getExtFromMimeType('IMAGE/JPEG')).toBe('jpg')
    })

    test('handles mime type with whitespace', () => {
      expect(getExtFromMimeType('  image/jpeg  ')).toBe('jpg')
    })

    test('returns .bin for unknown mime type', () => {
      expect(getExtFromMimeType('application/unknown')).toBe('.bin')
    })

    test('returns .bin for empty mime type', () => {
      expect(getExtFromMimeType('')).toBe('.bin')
    })

    test('handles mime type with multiple semicolons', () => {
      expect(getExtFromMimeType('image/png; charset=utf-8; boundary=something')).toBe('png')
    })
  })
})
