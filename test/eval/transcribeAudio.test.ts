import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { join } from 'node:path'
import { AIProvider } from '../../src/infra/ai'

setDefaultTimeout(30_000)

describe.if(!!process.env.TEST_AI)('Transcribe audio', () => {
  test('should transcribe voice.ogg file', async () => {
    const audioFile = Bun.file(join(import.meta.dir, '../voice.ogg'))
    const audio = await audioFile.arrayBuffer()

    const transcription = await AIProvider.transcribeAudio({ audio })

    expect(transcription).toBeTypeOf('string')
    expect(transcription.length).toBeGreaterThan(0)
  })
})
