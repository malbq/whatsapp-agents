import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { join } from 'node:path'
import { AIProvider } from '../../packages/core/ai'

setDefaultTimeout(30_000)

describe.if(!!import.meta.env.TEST_AI)('Analyze image', () => {
  test('should analyze jpg file', async () => {
    const imageFile = Bun.file(join(import.meta.dir, './analyzeImage.input.jpg'))
    const imageUrl = `data:image/jpeg;base64,${Buffer.from(await imageFile.bytes()).toString(
      'base64'
    )}`

    const analysis = await AIProvider.analyzeImage({ imageUrl })

    expect(analysis).toBeTypeOf('string')
    expect(analysis.toLowerCase()).toContain('paper')
    expect(analysis.toLowerCase()).toContain('arch')
    expect(analysis.toLowerCase()).toContain('hyprland')
    expect(analysis.length).toBeGreaterThan(0)
  })
})
