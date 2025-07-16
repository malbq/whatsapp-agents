import chalk from 'chalk'
import { join } from 'node:path'
import OpenAI from 'openai'
import imageAnalysisPrompt from '../../src/prompts/imageAnalysis.txt'

const client = new OpenAI()

let base64Image: string = ''
try {
  const imageFilePath = join(import.meta.dir, '668472096233253.jpg')
  const imageFile = Bun.file(imageFilePath)
  const imageBuffer = await imageFile.arrayBuffer()
  base64Image = Buffer.from(imageBuffer).toString('base64')
} catch (error) {
  console.error('Error reading image:', error)
  throw error
}

const models = [
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4o',
  'gpt-4o-mini',
]
models.forEach(async (model) => {
  try {
    const start = performance.now()
    const response = await client.responses.create({
      model,
      max_output_tokens: 500,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: imageAnalysisPrompt,
            },
            {
              type: 'input_image',
              image_url: `data:image/jpeg;base64,${base64Image}`,
              detail: 'auto',
            },
          ],
        },
      ],
    })
    const duration = performance.now() - start
    console.log(chalk.yellow(`Model ${model}`))
    console.log(chalk.gray(`Duration: ${duration}ms`))
    console.log(
      chalk.gray(
        `Tokens: ${response.usage?.total_tokens} = in:${response.usage?.input_tokens} out:${response.usage?.output_tokens}`
      )
    )
    console.log(response.output_text)
  } catch (error) {
    console.log(chalk.red(`Model ${model} failed`))
    console.error(error)
  }
})
