import { generateText } from 'ai'
import chalk from 'chalk'
import { join } from 'node:path'
import imageAnalysisPrompt from '../../src/prompts/imageAnalysis.txt'

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

const models = ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini']
models.forEach(async (model) => {
  try {
    const start = performance.now()
    const response = await generateText({
      model,
      maxOutputTokens: 500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: imageAnalysisPrompt,
            },
            {
              type: 'image',
              image: `data:image/jpeg;base64,${base64Image}`,
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
        `Tokens: ${response.usage?.totalTokens} = in:${response.usage?.inputTokens} out:${response.usage?.outputTokens}`
      )
    )
    console.log(response.text)
  } catch (error) {
    console.log(chalk.red(`Model ${model} failed`))
    console.error(error)
  }
})
