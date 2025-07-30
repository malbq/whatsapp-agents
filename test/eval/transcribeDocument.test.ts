import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { join } from 'node:path'
import { AIProvider } from '../../src/infra/ai'
import { parsePdf } from '../../src/utils/parsePdf'

setDefaultTimeout(30_000)

describe.if(!!process.env.TEST_AI)('Transcribe document', () => {
  test('should transcribe well-formed PDF document and compare with extracted content', async () => {
    const pdfBuffer = await Bun.file(join(import.meta.dirname, '../bun.pdf')).arrayBuffer()

    const llmResult = await AIProvider.transcribeDocument({
      document: pdfBuffer,
      mimeType: 'application/pdf',
      filename: 'bun.pdf',
    })

    const extractedText = await parsePdf(pdfBuffer)
    expect(llmResult).toBeDefined()
    expect(typeof llmResult).toBe('string')
    expect(llmResult.length).toBeGreaterThan(0)

    if (extractedText && extractedText.length > 0) {
      const jaccardSimilarity = calculateJaccardSimilarity(llmResult, extractedText)
      const similarityPercentage = calculateSimilarityPercentage(llmResult, extractedText)
      expect(jaccardSimilarity).toBeGreaterThan(0.9)
      expect(similarityPercentage).toBeGreaterThan(0.9)
    }
  })

  test('should transcribe flattened PDF document and compare with extracted content', async () => {
    const flattenedPdfBuffer = await Bun.file(
      join(import.meta.dirname, '../bun_flat.pdf')
    ).arrayBuffer()
    const textPdfBuffer = await Bun.file(join(import.meta.dirname, '../bun.pdf')).arrayBuffer()

    const llmResult = await AIProvider.transcribeDocument({
      document: flattenedPdfBuffer,
      mimeType: 'application/pdf',
      filename: 'bun_flat.pdf',
    })

    const extractedText = await parsePdf(textPdfBuffer)
    expect(llmResult).toBeDefined()
    expect(typeof llmResult).toBe('string')
    expect(llmResult.length).toBeGreaterThan(0)

    if (extractedText && extractedText.length > 0) {
      const jaccardSimilarity = calculateJaccardSimilarity(llmResult, extractedText)
      const similarityPercentage = calculateSimilarityPercentage(llmResult, extractedText)
      expect(jaccardSimilarity).toBeGreaterThan(0.9)
      expect(similarityPercentage).toBeGreaterThan(0.9)
    }
  })
})

function calculateSimilarityPercentage(text1: string, text2: string): number {
  const distance = levenshteinDistance(normalizeText(text1), normalizeText(text2))
  const maxLength = Math.max(normalizeText(text1).length, normalizeText(text2).length)
  return maxLength === 0 ? 1 : (maxLength - distance) / maxLength
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ') // normalize whitespace
    .replace(/[^\w\s]/g, '') // remove punctuation
    .trim()
}

function calculateJaccardSimilarity(text1: string, text2: string): number {
  const words1 = new Set(
    normalizeText(text1)
      .split(' ')
      .filter((w) => w.length > 0)
  )
  const words2 = new Set(
    normalizeText(text2)
      .split(' ')
      .filter((w) => w.length > 0)
  )

  const intersection = new Set([...words1].filter((x) => words2.has(x)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null))

  for (let i = 0; i <= str1.length; i++) matrix[0]![i] = i
  for (let j = 0; j <= str2.length; j++) matrix[j]![0] = j

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[j]![i] = Math.min(
        matrix[j]![i - 1]! + 1,
        matrix[j - 1]![i]! + 1,
        matrix[j - 1]![i - 1]! + indicator
      )
    }
  }

  return matrix[str2.length]![str1.length]!
}
