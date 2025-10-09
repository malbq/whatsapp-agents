import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { AIProvider } from '../../src/infra/ai'

setDefaultTimeout(30_000)

describe.if(!!import.meta.env.TEST_AI)('Respond text message', () => {
  test('should respond to text message', async () => {
    const { text } = await AIProvider.respond({
      messages: [{ role: 'user', content: 'Hi, how are you?' }],
    })

    expect(text).toBeTypeOf('string')
    expect(text.length).toBeGreaterThan(0)
  })
})
