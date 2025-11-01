import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { AIProvider } from '../../packages/core/ai'

setDefaultTimeout(30_000)

describe.if(!!import.meta.env.TEST_AI)('Respond text message', () => {
  test('should respond to text message', async () => {
    const { stream } = await AIProvider.respond({
      messages: [{ role: 'user', content: 'Hi, how are you?' }],
    })

    let text = ''
    for await (const chunk of stream) {
      text += chunk
    }

    expect(text).toBeTypeOf('string')
    expect(text.length).toBeGreaterThan(0)
  })
})
