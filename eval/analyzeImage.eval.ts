import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { join } from 'node:path'
import { AIProvider } from '../src/infra/ai'

setDefaultTimeout(30_000)

describe.if(!!import.meta.env.TEST_AI)('Analyze image', () => {
  test('should analyze storageFilesystem.input.jpg file', async () => {
    const imageFile = Bun.file(join(import.meta.dir, '../storageFilesystem.input.jpg'))
    const imageUrl = `data:image/jpeg;base64,${Buffer.from(await imageFile.bytes()).toString(
      'base64'
    )}`

    const analysis = await AIProvider.analyzeImage({ imageUrl })

    expect(analysis).toBeTypeOf('string')
    expect(analysis.length).toBeGreaterThan(0)
  })
})
