import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import chalk from 'chalk'
import path from 'node:path'

const audio = await Bun.file(path.join(import.meta.dir, 'wa.ogg')).bytes()

// console.time('ffmpeg')
// const ffmpeg = Bun.spawn(
//   ['ffmpeg', '-i', 'pipe:0', '-filter:a', 'atempo=2.0', '-f', 'ogg', 'pipe:1'],
//   { stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' }
// )
// ffmpeg.stdin.write(audio)
// ffmpeg.stdin.end()
// const processedAudio = new Uint8Array(await new Response(ffmpeg.stdout).arrayBuffer())
// console.timeEnd('ffmpeg')

const models = [
  google('gemini-2.5-flash-lite'),
  google('gemini-2.5-flash'),
  google('gemini-2.5-pro'),
]

models.forEach(async (model) => {
  const start = performance.now()
  const response = await generateText({
    model,
    temperature: 0,
    system: 'Generate a transcription of the audio file',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: audio,
            mediaType: 'audio/ogg',
          },
        ],
      },
    ],
  })
  const duration = performance.now() - start
  console.log(chalk.yellow(`Model ${model.provider}/${model.modelId}`))
  console.log(
    chalk.gray(
      `tokens: ${response.usage.totalTokens} (${response.usage.inputTokens}/${response.usage.outputTokens})`
    )
  )
  console.log(chalk.gray(`Duration: ${duration / 1000}s`))
  console.log(response.text)
})
