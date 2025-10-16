import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { AIProvider } from '../../src/infra/ai'

setDefaultTimeout(30_000)

describe.if(!!import.meta.env.TEST_AI)('Generate embeddings', () => {
  test('should return empty array for empty string', async () => {
    const result = await AIProvider.generateEmbeddings([''])
    console.log(result)
    expect(result).toBeArrayOfSize(1)
    expect(result[0]).toBeArrayOfSize(0)
  })

  test('should return empty array for whitespace-only string', async () => {
    const result = await AIProvider.generateEmbeddings(['   '])
    console.log(result)
    expect(result).toBeArrayOfSize(1)
    expect(result[0]).toBeArrayOfSize(0)
  })

  test('should handle empty string among valid strings', async () => {
    const result = await AIProvider.generateEmbeddings(['Hello world', '', 'Another message'])
    console.log(result)
    expect(result).toBeArrayOfSize(3)
    expect(result[0]!.length).toBeGreaterThan(0)
    expect(result[1]).toBeArrayOfSize(0)
    expect(result[2]!.length).toBeGreaterThan(0)
  })

  test('should generate embeddings for valid text', async () => {
    const result = await AIProvider.generateEmbeddings(['Hello, how are you?'])
    console.log(result)
    expect(result).toBeArrayOfSize(1)
    expect(result[0]!.length).toBeGreaterThan(0)
    expect(result[0]![0]).toHaveProperty('content')
    expect(result[0]![0]).toHaveProperty('embedding')
    expect(result[0]![0]!.embedding).toBeInstanceOf(Array)
  })
})
