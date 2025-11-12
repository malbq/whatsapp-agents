import { afterAll, afterEach, beforeAll, expect, test } from 'bun:test'
import { join } from 'node:path'
import type { Storage } from './storage'
import { FilesystemStorage } from './storageFilesystem'
import { sanitizeFilename } from '../utils/sanitizeFilename'

const storageBase = `/tmp/fs-storage-test-${Date.now()}`
let storage: Storage
const bucket = `test-bucket-${Date.now()}`

beforeAll(async () => {
  storage = FilesystemStorage.storage(storageBase)
})

afterEach(async () => {
  await Bun.$`rm -rf ${storageBase}/${bucket}*`.nothrow()
})

afterAll(async () => {
  await Bun.$`rm -rf ${storageBase}`.nothrow()
})

test('Store and retrieve real image file', async () => {
  const file = Bun.file(join(import.meta.dirname, './storageFilesystem.test.jpg'))
  const key = `${bucket}/real-image-file`
  await storage.store({
    key,
    data: await file.arrayBuffer(),
    mimeType: file.type,
  })

  const retrieved = await storage.retrieve(key)
  expect(retrieved.mimeType).toBe(file.type)
  const retrievedBytes = new Uint8Array(retrieved.data)
  expect(retrievedBytes[0]).toBe(0xff)
  expect(retrievedBytes[1]).toBe(0xd8)
  expect(retrieved.data.byteLength).toBe(file.size)
  expect(retrievedBytes).toEqual(new Uint8Array(await file.arrayBuffer()))
})

test('Retrieved image can be converted to base64 for AI processing', async () => {
  const file = Bun.file(join(import.meta.dirname, './storageFilesystem.test.jpg'))
  const key = `${bucket}/base64`
  await storage.store({
    key,
    data: await file.arrayBuffer(),
    mimeType: file.type,
  })

  const originalBase64Image = Buffer.from(await file.arrayBuffer()).toString('base64')
  const retrieved = await storage.retrieve(key)
  const retrievedBase64Image = Buffer.from(retrieved.data).toString('base64')

  expect(retrievedBase64Image).toBeDefined()
  expect(retrievedBase64Image.length).toBeGreaterThan(0)
  expect(retrievedBase64Image).toMatch(/^[A-Za-z0-9+/=]+$/)
  expect(retrievedBase64Image).toBe(originalBase64Image)

  const dataUrl = `data:${retrieved.mimeType};base64,${retrievedBase64Image}`
  expect(dataUrl).toStartWith('data:image/')
})

test('Retrieved image format is valid', async () => {
  const key = `${bucket}/image-format`
  await storage.store({
    key,
    data: await new ArrayBuffer(1024),
    mimeType: 'image/jpeg',
  })

  const retrieved = await storage.retrieve(key)
  const retrievedFile = new File([retrieved.data], 'test.jpg', { type: retrieved.mimeType })

  expect(retrievedFile.size).toBe(1024)
  expect(retrievedFile.type).toBe('image/jpeg')
})

test('sanitizeFilename utility function', () => {
  expect(sanitizeFilename('simple.jpg')).toBe('simple.jpg')
  expect(sanitizeFilename('file with spaces.png')).toBe('file_with_spaces.png')
  expect(sanitizeFilename('file<>:"/\\|?*.txt')).toBe('file_.txt')
  expect(sanitizeFilename('  leading spaces  ')).toBe('leading_spaces')
  expect(sanitizeFilename('multiple   spaces')).toBe('multiple_spaces')
  expect(sanitizeFilename('')).toBe('')
  expect(sanitizeFilename('a'.repeat(150)).length).toBeLessThan(150)
})
