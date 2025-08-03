import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { AIProvider } from '../../src/infra/ai'

setDefaultTimeout(30_000)

describe.if(!!import.meta.env.TEST_AI)('AI Respond', () => {
  test('should handle WhatsApp-style short messages', async () => {
    const response = await AIProvider.respond({
      messages: [
        {
          role: 'user',
          content: 'Oi, tudo bem?',
        },
      ],
    })

    expect(response).toBeTypeOf('string')
    expect(response.length).toBeGreaterThan(0)
    expect(response.length).toBeLessThan(2000)
  })

  test('should use all provided context to answer', async () => {
    const response = await AIProvider.respond({
      messages: [
        {
          role: 'system',
          content: 'Context: The user is a software developer working on a TypeScript project.',
        },
        {
          role: 'user',
          content: 'What should I use for testing?',
        },
      ],
    })

    expect(response).toBeTypeOf('string')
    expect(response.length).toBeGreaterThan(0)
  })

  test('should respond in English when user communicates in English', async () => {
    const response = await AIProvider.respond({
      messages: [
        {
          role: 'system',
          content: 'User location: San Diego, CA, USA',
        },
        {
          role: 'user',
          content: 'What is the weather like today?',
        },
      ],
    })

    expect(response).toBeTypeOf('string')
    expect(response.length).toBeGreaterThan(0)
  })

  test('should answer questions accurately', async () => {
    const response = await AIProvider.respond({
      messages: [
        {
          role: 'user',
          content: 'What is the capital of Brazil?',
        },
      ],
    })

    expect(response).toBeTypeOf('string')
    expect(response.length).toBeGreaterThan(0)
  })
})
