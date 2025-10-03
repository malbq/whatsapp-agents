#!/usr/bin/env bun

/**
 * User Profile Update Prompt Evaluator
 *
 * USAGE:
 *   bun run eval/updateUserProfile.eval.ts [options]
 *
 * ARGUMENTS:
 *   --n, -n: Number of prompt variants to generate and test (default: 3, max: 10)
 *   --k, -k: Number of sequential messages in test scenarios (default: 3, max: 10)
 *
 * OUTPUT:
 *   - Creates timestamped JSON file in eval/updateUserProfile-runs/
 *   - Contains complete evaluation results for all variants
 *   - Includes scenario details, outputs, and judge feedback
 *   - Identifies the best performing prompt variant
 *
 * EXAMPLE:
 *   bun run eval/updateUserProfile.eval.ts --n 5 --k 4
 *   # Generates 5 prompt variants, tests with 4-message scenarios
 */

// @ts-nocheck

import { openai } from '@ai-sdk/openai'
import { generateObject } from 'ai'
import { existsSync, mkdirSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { z } from 'zod'

import { updateUserProfile } from '../../src/agent/prompts/updateUserProfile'
import { configureEvalLogging } from '../../src/config/logging'
import { AIProvider } from '../../src/infra/ai'

const GPT5_MODEL = openai('gpt-5')
const GPT5_MINI_MODEL = openai('gpt-5-mini')

interface Scenario {
  id: string
  messages: string[]
  expectations: string[]
}

interface JudgeResult {
  score: number
  feedback: string
}

interface VariantResult {
  id: string
  body: string
  outputs: string[]
  judge: JudgeResult
}

interface EvaluationResult {
  id: string
  timestamp: string
  scenario: Scenario
  baseline: VariantResult
  variants: VariantResult[]
  best: { id: string; score: number }
}

async function generateSequentialScenario(messageCount: number): Promise<Scenario> {
  const scenarioSchema = z.object({
    id: z.string(),
    messages: z.array(z.string()).length(messageCount),
    expectations: z.array(z.string()).length(messageCount),
  })

  const response = await generateObject({
    model: GPT5_MINI_MODEL,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(60000),
    prompt: `Generate a test scenario with exactly ${messageCount} messages for evaluating a user profile update system.
The scenario should test how well the system accumulates information across a sequence of messages.

Requirements:
- Generate exactly ${messageCount} messages that gradually reveal user information
- Messages should be realistic user inputs (questions, statements, requests)
- Test different aspects: language detection, personal details, preferences, privacy boundaries
- Include one message that tests privacy-sensitive information (health, politics, religion)
- Messages should build upon each other naturally
- Provide exactly ${messageCount} expectations describing what should be accumulated after each message

Return JSON with:
- id: short descriptive name for the scenario
- messages: array of exactly ${messageCount} user messages
- expectations: array of exactly ${messageCount} descriptions of expected profile state after each message

Example message sequence:
1. "Olá!" (should detect Portuguese)
2. "Meu nome é João e moro em São Paulo" (should add name and location)
3. "Trabalho como desenvolvedor de software" (should add profession)
4. "Adoro jogar futebol nos fins de semana" (should add hobby)`,
    schema: scenarioSchema,
  })

  return response.object
}

function extractBaselineBody(): string {
  const fullPrompt = updateUserProfile('', '')
  const markerIndex = fullPrompt.indexOf('<current_user_profile>')
  if (markerIndex === -1) {
    throw new Error('Could not find <current_user_profile> marker in prompt')
  }
  return fullPrompt.substring(0, markerIndex).trim()
}

async function generateSingleVariant(
  baselineBody: string,
  previousFeedback?: { score: number; feedback: string; body: string }
): Promise<string> {
  const variantSchema = z.object({
    variant: z.string(),
  })

  let contextualPrompt = `Generate 1 improved variation of the following prompt body for updating user profiles. 
The variation should maintain the core functionality but use different wording, structure, or emphasis.
Keep the same privacy guidelines and output format requirements.
Focus on improving clarity, effectiveness, and user profile extraction quality.

Original prompt body:
${baselineBody}`

  if (previousFeedback) {
    contextualPrompt += `

FEEDBACK FROM PREVIOUS ITERATION:
Previous variant (score: ${previousFeedback.score}/10):
${previousFeedback.feedback}

Previous variant body:
${previousFeedback.body}

IMPROVEMENT INSTRUCTIONS:
- Address the specific issues mentioned in the feedback above
- Build upon any strengths identified in the feedback
- Make targeted improvements to increase the score
- Focus on the areas where the previous variant was weak`
  }

  contextualPrompt += `

Return exactly 1 improved variant as a JSON object with a "variant" field.`

  const response = await generateObject({
    model: GPT5_MODEL,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(120000),
    prompt: contextualPrompt,
    schema: variantSchema,
  })

  return response.object.variant
}

function createPromptFromBody(body: string): (profile: string, message: string) => string {
  return (profile: string, message: string) => `${body}
<current_user_profile>
${profile}
</current_user_profile>
<last_user_message>
"${message}"
</last_user_message>`
}

async function evaluateVariant(variantBody: string, scenario: Scenario): Promise<string[]> {
  const sequenceOutputs: string[] = []
  const promptFn = createPromptFromBody(variantBody)
  let currentProfile = ''

  try {
    for (const message of scenario.messages) {
      const result = await AIProvider.improveUserProfile({
        instructions: promptFn,
        profile: currentProfile,
        message,
      })
      sequenceOutputs.push(result)
      if (result.trim() !== '') {
        currentProfile = result
      }
    }
    return sequenceOutputs
  } catch (error) {
    const errorMessage = `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`
    return [errorMessage]
  }
}

async function judgeVariant(
  variantBody: string,
  outputs: string[],
  scenario: Scenario
): Promise<JudgeResult> {
  const sequenceResults = scenario.messages
    .map(
      (message, index) =>
        `Message ${index + 1}: "${message}"
Expected: ${scenario.expectations[index] || 'No expectation'}
Output: "${outputs[index] || 'No output'}"
Profile After: "${outputs[index] || 'No profile'}"`
    )
    .join('\n')

  const finalProfile = outputs[outputs.length - 1] || 'No final profile'

  const judgeSchema = z.object({
    score: z.number().min(0).max(10),
    feedback: z.string(),
  })

  const response = await generateObject({
    model: GPT5_MODEL,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(90000),
    prompt: `Rate this user profile update prompt variant on a scale of 0-10 based on:
- Information Accumulation: How well it builds profiles across message sequences (3 points)
- Consistency: How consistent the profile updates are within each sequence (3 points)
- Completeness: How well the final profiles capture all relevant information (2 points)
- Privacy Compliance: How well it follows privacy guidelines across all messages (1 points)
- Error Handling: How it handles edge cases and maintains profile integrity (1 points)

Prompt body:
${variantBody}

Test scenario: ${scenario.id}
${sequenceResults}

Final Profile: "${finalProfile}"

Provide a single overall score (0-10) and brief feedback explaining the rating, focusing on how well the system accumulates information across the message sequence.`,
    schema: judgeSchema,
  })

  return response.object
}

async function runEvaluation(variantCount: number, messageCount: number): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const runId = `updateUserProfile-${timestamp}`

  console.log(`Starting evaluation: ${runId}`)
  console.log(`Variants: ${variantCount}, Messages: ${messageCount}`)

  console.log('Generating sequential scenario...')
  let scenario: Scenario
  try {
    scenario = await generateSequentialScenario(messageCount)
    console.log(`✓ Generated scenario: ${scenario.id}`)
  } catch (error) {
    console.error('✗ Failed to generate scenario:', error instanceof Error ? error.message : error)
    throw error
  }
  const baselineBody = extractBaselineBody()

  console.log('Evaluating baseline...')
  const baselineOutputs = await evaluateVariant(baselineBody, scenario)
  const baselineJudge = await judgeVariant(baselineBody, baselineOutputs, scenario)

  const baseline: VariantResult = {
    id: 'baseline',
    body: baselineBody,
    outputs: baselineOutputs,
    judge: baselineJudge,
  }

  console.log(`✓ Baseline evaluated (score: ${baselineJudge.score}/10)`)

  console.log('Generating and evaluating variants iteratively...')
  const variants: VariantResult[] = []
  let previousFeedback: { score: number; feedback: string; body: string } = {
    score: baselineJudge.score,
    feedback: baselineJudge.feedback,
    body: baselineBody,
  }

  for (let i = 0; i < variantCount; i++) {
    const variantId = `variant-${i + 1}`
    console.log(`Generating ${variantId} using previous feedback...`)

    try {
      const variantBody = await generateSingleVariant(baselineBody, previousFeedback)
      console.log(`✓ ${variantId} generated`)

      console.log(`Evaluating ${variantId}...`)
      const outputs = await evaluateVariant(variantBody, scenario)
      const judge = await judgeVariant(variantBody, outputs, scenario)

      const variant: VariantResult = {
        id: variantId,
        body: variantBody,
        outputs,
        judge,
      }

      variants.push(variant)
      console.log(`✓ ${variantId} evaluated (score: ${judge.score}/10)`)

      // Update feedback for next iteration
      previousFeedback = {
        score: judge.score,
        feedback: judge.feedback,
        body: variantBody,
      }
    } catch (error) {
      console.error(
        `✗ Failed to generate/evaluate ${variantId}:`,
        error instanceof Error ? error.message : error
      )
      throw error
    }
  }

  const allResults = [baseline, ...variants]
  const best = allResults.reduce((prev, current) =>
    current.judge.score > prev.judge.score ? current : prev
  )

  const result: EvaluationResult = {
    id: runId,
    timestamp,
    scenario,
    baseline,
    variants,
    best: { id: best.id, score: best.judge.score },
  }

  const runDir = '/home/mauro/dev/zapid/eval/updateUserProfile-runs'
  if (!existsSync(runDir)) {
    mkdirSync(runDir, { recursive: true })
  }

  const outputPath = `${runDir}/${runId}.json`
  await Bun.write(outputPath, JSON.stringify(result, null, 2))

  console.log('\n=== EVALUATION RESULTS ===')
  console.log(`Run ID: ${runId}`)
  console.log(`Saved to: ${outputPath}`)
  console.log(`Scenario: ${scenario.id}`)
  console.log('\nRanked Results:')

  allResults
    .sort((a, b) => b.judge.score - a.judge.score)
    .forEach((variant, index) => {
      console.log(
        `${index + 1}. ${variant.id}: ${variant.judge.score}/10 - ${variant.judge.feedback}`
      )
    })

  console.log(`\nBest variant: ${best.id} (${best.judge.score}/10)`)
  console.log('Best prompt body:')
  console.log('---')
  console.log(best.body)
  console.log('---')
}

async function main() {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      n: {
        type: 'string',
        short: 'n',
        default: '3',
      },
      k: {
        type: 'string',
        short: 'k',
        default: '3',
      },
    },
    allowPositionals: true,
  })

  const variantCount = parseInt(values.n ?? '3', 10)
  const messageCount = parseInt(values.k ?? '3', 10)

  if (variantCount < 1 || variantCount > 10) {
    console.error('Variant count (-n) must be between 1 and 10')
    process.exit(1)
  }

  if (messageCount < 1 || messageCount > 10) {
    console.error('Message count (-k) must be between 1 and 10')
    process.exit(1)
  }

  try {
    await configureEvalLogging()
    await runEvaluation(variantCount, messageCount)
  } catch (error) {
    console.error('Evaluation failed:', error)
    process.exit(1)
  }
}

if (import.meta.main) {
  main()
}
