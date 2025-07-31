import { generateObject } from 'ai'
import chalk from 'chalk'
import path from 'node:path'
import { format, instructions, requiredContext } from '../../../src/prompts/intentClassification'

const inputData = path.join(import.meta.dir, 'data.json')
const report = path.join(import.meta.dir, 'report.csv')

const data = (await Bun.file(inputData).json()) as Array<{
  input: string
  output: Array<(typeof requiredContext)[number]>
}>

let tokens = 0
let correct = 0
let incorrect = 0
const results: string[][] = await Promise.all(
  data.slice(0, 10).map(async (item) => {
    const response = await generateObject({
      model: 'gpt-4.1-mini-2025-04-14',
      system: instructions,
      schema: format,
      prompt: item.input,
    })
    const classification = JSON.stringify(
      response.object.context.sort((a: string, b: string) => a.localeCompare(b)) ?? []
    )

    const expected = JSON.stringify(item.output.sort((a: string, b: string) => a.localeCompare(b)))

    const isEqual = classification === expected

    if (isEqual) {
      correct++
    } else {
      incorrect++
    }

    console.log(item.input)
    console.log(
      isEqual ? chalk.green(classification) : chalk.red(`${classification} expected: ${expected}`)
    )

    tokens += response.usage?.totalTokens ?? 0
    return [item.input, classification, expected, isEqual ? '' : '❌']
  })
)

console.log(`------------------------------------`)
console.log(`✅ ${correct}`)
console.log(`❌ ${incorrect}`)
console.log(`total tokens: ${tokens}`)

const csvHeader = ['input', 'classification', 'expected', 'status']
const csvContent = [csvHeader, ...results]
  .map((row) => row.map((field) => `"${field.replace(/"/g, '""')}"`).join(','))
  .join('\n')

await Bun.write(report, csvContent)
console.log(`Report saved to ${report}`)
