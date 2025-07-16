import chalk from 'chalk'
import path from 'node:path'
import OpenAI from 'openai'

const client = new OpenAI()

const audio = Bun.file(path.join(import.meta.dir, 'wa.ogg'))

console.time('ffmpeg')
const ffmpeg = Bun.spawn(
  ['ffmpeg', '-i', 'pipe:0', '-filter:a', 'atempo=2.0', '-f', 'ogg', 'pipe:1'],
  { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' }
)
ffmpeg.stdin.write(new Uint8Array(await audio.arrayBuffer()))
ffmpeg.stdin.end()
const ffmpegResult = await new Response(ffmpeg.stdout).arrayBuffer()
const processedAudio = new File([ffmpegResult], 'processed_audio.ogg', {
  type: 'audio/ogg',
})
console.timeEnd('ffmpeg')

const models = ['whisper-1', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe']

models.forEach(async (model) => {
  const start = performance.now()
  const response = await client.audio.transcriptions.create({
    model,
    file: processedAudio,
    language: 'pt',
    response_format: 'json',
  })
  const duration = performance.now() - start
  console.log(chalk.yellow(`Model ${model}`))
  console.log(chalk.gray(`Duration: ${duration}ms`))
  console.log(JSON.stringify(response, null, 2))
})
