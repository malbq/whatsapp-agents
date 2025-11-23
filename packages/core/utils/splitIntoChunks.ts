import nlp from 'compromise'
import { retext } from 'retext'
import retextReadability from 'retext-readability'

export async function splitIntoSentences(text: string): Promise<string[]> {
  const parsed = text
    .toWellFormed()
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[:;]/g, '.')
  const readable = await retext().use(retextReadability).process(parsed)
  return nlp(readable.toString()).sentences().out('array')
}

export async function splitIntoChunks(text: string, maxChunkSize: number): Promise<string[]> {
  if (!text) return []

  if (text.length <= maxChunkSize) {
    return [text]
  }

  const sentences = await splitIntoSentences(text)

  const chunks: string[] = []
  let currentChunk = ''

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize) {
      if (currentChunk) chunks.push(currentChunk)
      if (sentence.length > maxChunkSize) {
        let remaining = sentence
        while (remaining.length > maxChunkSize) {
          const lastSpaceIndex = remaining.lastIndexOf(' ', maxChunkSize)
          const splitIndex = lastSpaceIndex > 0 ? lastSpaceIndex : maxChunkSize
          chunks.push(remaining.substring(0, splitIndex))
          remaining = remaining.substring(splitIndex).trim()
        }
        currentChunk = remaining
      } else {
        currentChunk = sentence
      }
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence
    }
  }
  if (currentChunk) chunks.push(currentChunk)

  return chunks.length > 0 ? chunks : [text]
}
