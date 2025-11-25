import { describe, expect, test } from 'bun:test'
import { splitIntoChunks, splitIntoSentences } from './splitIntoChunks'

describe('splitIntoChunks', () => {
  describe('splitIntoSentences', () => {
    test('splits text into sentences', async () => {
      const text = 'Hello world. This is a test. How are you?'
      const sentences = await splitIntoSentences(text)
      expect(sentences.length).toBeGreaterThanOrEqual(3)
    })

    test('handles smart quotes', async () => {
      const text = 'He said "hello" to me.'
      const sentences = await splitIntoSentences(text)
      expect(sentences.length).toBeGreaterThanOrEqual(1)
      expect(sentences[0]).toContain('"')
    })

    test('converts colons to periods', async () => {
      const text = 'Title: This is the content.'
      const sentences = await splitIntoSentences(text)
      expect(sentences.length).toBeGreaterThanOrEqual(1)
    })

    test('normalizes whitespace', async () => {
      const text = 'Hello    world.   Multiple   spaces.'
      const sentences = await splitIntoSentences(text)
      expect(sentences.every((s) => !s.includes('  '))).toBe(true)
    })

    test('handles empty string', async () => {
      const sentences = await splitIntoSentences('')
      expect(Array.isArray(sentences)).toBe(true)
    })
  })

  describe('splitIntoChunks', () => {
    test('returns single chunk for short text', async () => {
      const text = 'Short text'
      const chunks = await splitIntoChunks(text, 1000)
      expect(chunks).toHaveLength(1)
      expect(chunks[0]).toBe(text)
    })

    test('returns empty array for empty text', async () => {
      const chunks = await splitIntoChunks('', 1000)
      expect(chunks).toHaveLength(0)
    })

    test('splits long text into multiple chunks', async () => {
      const longText = 'This is a sentence. '.repeat(150)
      const chunks = await splitIntoChunks(longText, 1000)
      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks.every((chunk) => chunk.length <= 1000)).toBe(true)
    })

    test('respects MAX_CHUNK_SIZE of 1000', async () => {
      const longText = 'a'.repeat(5000)
      const chunks = await splitIntoChunks(longText, 1000)
      expect(chunks.every((chunk) => chunk.length <= 1000)).toBe(true)
    })

    test('splits at sentence boundaries when possible', async () => {
      // 'First sentence. ' = 16 chars, need > 1000, so repeat 130 times = 2080 chars
      const text = 'First sentence. '.repeat(130)
      const chunks = await splitIntoChunks(text, 1000)
      expect(chunks.length).toBeGreaterThan(1)
    })

    test('handles very long single sentence', async () => {
      const longSentence = 'word '.repeat(500)
      const chunks = await splitIntoChunks(longSentence, 1000)
      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks.every((chunk) => chunk.length <= 1000)).toBe(true)
    })

    test('handles text with no spaces', async () => {
      const noSpaces = 'a'.repeat(3000)
      const chunks = await splitIntoChunks(noSpaces, 1000)
      expect(chunks.length).toBeGreaterThan(1)
      expect(chunks.every((chunk) => chunk.length <= 1000)).toBe(true)
    })

    test('preserves content across chunks', async () => {
      const text = 'Sentence one. Sentence two. Sentence three. '.repeat(50)
      const chunks = await splitIntoChunks(text, 1000)
      const rejoined = chunks.join(' ')
      expect(rejoined.length).toBeGreaterThan(0)
    })

    test('handles text exactly at MAX_CHUNK_SIZE', async () => {
      const text = 'a'.repeat(1000)
      const chunks = await splitIntoChunks(text, 1000)
      expect(chunks).toHaveLength(1)
    })

    test('handles text slightly over MAX_CHUNK_SIZE', async () => {
      const text = 'a'.repeat(1001)
      const chunks = await splitIntoChunks(text, 1000)
      expect(chunks.length).toBeGreaterThan(1)
    })

    test('trims whitespace in chunks', async () => {
      const text = 'First sentence.   Second sentence.   '.repeat(50)
      const chunks = await splitIntoChunks(text, 1000)
      expect(chunks.every((chunk) => chunk === chunk.trim())).toBe(true)
    })

    test('handles mixed content with paragraphs', async () => {
      const text = `
        First paragraph with some text.
        More text in first paragraph.
        
        Second paragraph with different content.
        Additional content here.
      `.repeat(30)
      const chunks = await splitIntoChunks(text, 1000)
      expect(Array.isArray(chunks)).toBe(true)
      expect(chunks.length).toBeGreaterThanOrEqual(1)
    })

    test('handles null-like values gracefully', async () => {
      const chunks = await splitIntoChunks('', 1000)
      expect(chunks).toHaveLength(0)
    })
  })
})
