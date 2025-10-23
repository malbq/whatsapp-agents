#!/usr/bin/env bun

/**
 * Prompt Optimization Runner
 *
 * USAGE:
 *   bun run eval/optimization/run.ts --scenarios <scenario1> [scenario2...] [options]
 *
 * REQUIRED ARGUMENTS:
 *   --scenarios, -s: One or more scenario config files to evaluate against
 *
 * OPTIONAL ARGUMENTS:
 *   --generations, -g: Number of evolutionary generations (default: 3)
 *   --population, -p: Population size per generation (default: 8)
 *   --seed, -r: Random seed for reproducible results (optional)
 *
 * SCENARIO CONFIG FILES:
 *   JSON files defining test scenarios with conversation context and evaluation criteria.
 *   Each scenario tests different aspects of prompt performance.
 *
 * OUTPUT:
 *   - Creates directory: optimization/reports/<run_id>/
 *   - Saves all candidates, evaluations, and optimization metadata
 *   - Generates summary with best performing prompt
 *   - Tracks generation statistics and context-specific scores
 *
 * EXAMPLE:
 *   bun run eval/optimization/run.ts \
 *     --scenarios scenarios/basic.json scenarios/complex.json \
 *     --generations 5 \
 *     --population 12
 */

// @ts-nocheck

import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'

import { audioTranscription } from '../../src/agent/prompts/audioTranscription.js'
import { documentTranscription } from '../../src/agent/prompts/documentTranscription.js'
import { imageDescription } from '../../src/agent/prompts/imageDescription.js'
import { recentMessages as recentMessagesPrompt } from '../../src/agent/prompts/recentMessages.js'
import { userProfile as userProfilePrompt } from '../../src/agent/prompts/userProfile.js'
import { configureEvalLogging } from '../../src/config/logging.js'
import { AIProvider } from '../../src/infra/ai.js'

import { PromptGenerator } from './generator.js'
import { Judge } from './judge.js'
import { OptimizationStorage } from './storage.js'
import type {
  Candidate,
  ContextPreset,
  EvaluationResult,
  OptimizationRun,
  RunSummary,
  ScenarioConfig,
} from './types.js'

interface RunConfig {
  scenarios: string[]
  generations: number
  populationSize: number
  mutationRate?: number
  crossoverRate?: number
  eliteSize?: number
  seed?: number
}

const DEFAULT_CONFIG: Partial<RunConfig> = {
  mutationRate: 0.3,
  crossoverRate: 0.6,
  eliteSize: 0.2,
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      scenarios: {
        type: 'string',
        multiple: true,
        short: 's',
      },
      generations: {
        type: 'string',
        short: 'g',
        default: '3',
      },
      population: {
        type: 'string',
        short: 'p',
        default: '8',
      },
      seed: {
        type: 'string',
        short: 'r',
      },
    },
  })

  if (!values.scenarios || values.scenarios.length === 0) {
    console.error(
      'Usage: bun run eval/optimization/run.ts --scenarios <scenario1> [scenario2...] [options]'
    )
    console.error('Options:')
    console.error('  -s, --scenarios    Scenario config files (required)')
    console.error('  -g, --generations  Number of generations (default: 3)')
    console.error('  -p, --population   Population size per generation (default: 8)')
    console.error('  -r, --seed         Random seed for reproducible results (optional)')
    process.exit(1)
  }

  const runConfig: RunConfig = {
    scenarios: values.scenarios,
    generations: parseInt(values.generations as string),
    populationSize: parseInt(values.population as string),
    seed: values.seed ? parseInt(values.seed as string) : undefined,
    ...DEFAULT_CONFIG,
  }

  const runId = generateRunId()

  await configureEvalLogging()

  console.log(`Starting optimization run: ${runId}`)
  console.log(`Scenarios: ${runConfig.scenarios.join(', ')}`)
  console.log(`Generations: ${runConfig.generations}, Population: ${runConfig.populationSize}`)

  const optimizer = new PromptOptimizer(runId, runConfig)
  await optimizer.run()
}

class PromptOptimizer {
  private storage: OptimizationStorage
  private generator: PromptGenerator
  private judge: Judge
  private config: RunConfig
  private runId: string

  constructor(runId: string, config: RunConfig) {
    this.runId = runId
    this.config = config
    this.storage = new OptimizationStorage(runId)
    this.generator = new PromptGenerator(config.seed)
    this.judge = new Judge()
  }

  async run(): Promise<void> {
    const startTime = new Date()

    const optimizationRun: OptimizationRun = {
      runId: this.runId,
      startTime,
      scenarios: this.config.scenarios,
      generations: this.config.generations,
      populationSize: this.config.populationSize,
      config: {
        mutationRate: this.config.mutationRate!,
        crossoverRate: this.config.crossoverRate!,
        eliteSize: this.config.eliteSize!,
      },
    }

    await this.storage.saveRun(optimizationRun)
    await this.generator.loadComponents()

    let population = this.generator.generateSeedCandidates(this.config.populationSize)
    console.log(`Generated ${population.length} seed candidates`)

    const saveCandidatePromises = population.map((candidate) =>
      this.storage.saveCandidate(candidate)
    )
    await Promise.all(saveCandidatePromises)

    const generationStats: Array<{
      generation: number
      bestScore: number
      averageScore: number
      diversity: number
    }> = []

    for (let generation = 1; generation <= this.config.generations; generation++) {
      console.log(`\n=== Generation ${generation} ===`)
      // Note: Generation N evaluates candidates created in generation N-1
      // Generation 1 evaluates seed candidates (generation=0)
      // Generation N>1 evaluates candidates with generation=N-1

      const results = await this.evaluateGeneration(population, generation)

      const scores = results.map((r) => r.score)
      const bestScore = Math.max(...scores)
      const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length
      const diversity = this.calculateDiversity(population)

      generationStats.push({
        generation,
        bestScore,
        averageScore,
        diversity,
      })

      console.log(
        `Generation ${generation} - Best: ${bestScore.toFixed(2)}, Average: ${averageScore.toFixed(
          2
        )}, Diversity: ${diversity.toFixed(2)}`
      )

      if (generation < this.config.generations) {
        const rankedCandidates = this.rankCandidates(population, results)
        population = this.generator.generateVariants(
          rankedCandidates,
          this.config.populationSize,
          generation + 1,
          {
            crossoverRate: this.config.crossoverRate!,
            eliteSize: this.config.eliteSize!,
            mutationRate: this.config.mutationRate!,
            feedback: this.collectFeedback(results),
          }
        )

        const savePromises = population.map((candidate) => this.storage.saveCandidate(candidate))
        await Promise.all(savePromises)
      }
    }

    const finalResults = await this.storage.getAllResults()
    const bestCandidate = this.findBestCandidate(await this.storage.loadCandidates(), finalResults)

    const contextAgg = this.aggregateContextScores(finalResults)
    const summary: RunSummary = {
      runId: this.runId,
      bestCandidate,
      bestScore: Math.max(...finalResults.map((r) => r.score)),
      averageScore: finalResults.reduce((sum, r) => sum + r.score, 0) / finalResults.length,
      totalEvaluations: finalResults.length,
      totalTokens: finalResults.reduce((sum, r) => sum + r.usage.tokens, 0),
      generationStats,
      contextScores: contextAgg.scores,
      bestContextId: contextAgg.bestContextId,
    }

    optimizationRun.endTime = new Date()
    optimizationRun.bestCandidateId = bestCandidate.id

    await this.storage.saveRun(optimizationRun)
    await this.storage.saveSummary(summary)

    console.log(`\n=== Optimization Complete ===`)
    console.log(`Best candidate: ${bestCandidate.id} (score: ${summary.bestScore.toFixed(2)})`)
    console.log(`Total tokens: ${summary.totalTokens.toLocaleString()}`)
    if (summary.contextScores.length) {
      console.log(`Best context: ${summary.bestContextId}`)
    }
    console.log(`Results saved to: optimization/reports/${this.runId}/`)
  }

  private async evaluateGeneration(
    candidates: Candidate[],
    _generation: number
  ): Promise<EvaluationResult[]> {
    const allResults: EvaluationResult[] = []

    const evaluationPromises = []

    const contextPresets = this.generator.getContextPresets()

    for (const scenario of this.config.scenarios) {
      console.log(`Evaluating scenario: ${scenario}`)

      for (const candidate of candidates) {
        console.log(`  Candidate: ${candidate.id}`)

        for (const preset of contextPresets) {
          evaluationPromises.push(
            this.runScenario(candidate.fullPrompt, scenario, preset).then(
              async ({ response, messageThread, contextId }) => {
                const scenarioName = scenario.split('/').pop()?.replace('.json', '') || scenario
                const result = await this.judge.evaluate(
                  candidate.id,
                  scenarioName,
                  candidate.fullPrompt,
                  response,
                  messageThread
                )
                result.contextId = contextId

                // Calculate efficiency score
                result.efficiencyScore = this.calculateEfficiencyScore(
                  result.score,
                  result.usage.tokens
                )

                await this.storage.saveResult(result)
                return result
              }
            )
          )
        }
      }
    }

    const results = await Promise.all(evaluationPromises)
    allResults.push(...results)

    return allResults
  }

  private async runScenario(
    systemPrompt: string,
    scenarioPath: string,
    preset: ContextPreset
  ): Promise<{
    response: string
    messageThread: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
    contextId: string
  }> {
    const scenarioContent = await readFile(scenarioPath, 'utf-8')
    const parsed = JSON.parse(scenarioContent) as unknown
    const scenario = this.normalizeScenario(parsed)

    const { instructions, messages } = this.buildMessages(systemPrompt, scenario, preset)

    const searchFilesCallback = async () =>
      scenario.context?.fileSearchResults?.map((r) => ({
        ...r,
        timestamp: new Date(r.timestamp),
      })) ?? []

    const result = await AIProvider.respond({
      instructions,
      messages,
      searchFilesCallback,
    })

    let responseText = ''
    for await (const chunk of result.stream) {
      responseText += chunk
    }

    return {
      response: responseText,
      messageThread: messages,
      contextId: preset.id,
    }
  }

  private buildMessages(
    systemPrompt: string,
    scenario: ScenarioConfig,
    preset: ContextPreset
  ): {
    instructions: string
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  } {
    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []

    if (scenario.context?.profile && preset.config.includeUserProfile) {
      messages.push({ role: 'system', content: userProfilePrompt(scenario.context.profile) })
    }

    if (scenario.context?.similarMessages?.length && preset.config.includeSimilarMessages) {
      const body = scenario.context.similarMessages
        .map(
          (m, idx) =>
            `${m.role}: ${m.content} (chunk ${m.chunkSequence ?? idx + 1}/${
              m.totalChunks ?? scenario.context!.similarMessages!.length
            })`
        )
        .join('\n')
      messages.push({
        role: 'system',
        content: `This is a list of relevant information we gathered by searching every exchange with the user.
<memory>
${body}
</memory>
Integrate these memories to provide context-aware answers and maintain conversation continuity.`,
      })
    }

    if (scenario.context?.recentMessages?.length && preset.config.includeRecentThreadDisclaimer) {
      messages.push({ role: 'system', content: recentMessagesPrompt })
      for (const msg of scenario.context.recentMessages) {
        messages.push(msg)
      }
    }

    if (preset.config.includeMediaDisclaimers) {
      if (scenario.context?.inboundType === 'audio') {
        messages.push({ role: 'system', content: audioTranscription })
      }
      if (scenario.context?.inboundType === 'image') {
        messages.push({ role: 'system', content: imageDescription })
      }
      if (scenario.context?.inboundType === 'document') {
        const filename = scenario.context.filename
        messages.push({ role: 'system', content: documentTranscription(filename) })
      }
    }

    const baseMessages =
      scenario.messages && scenario.messages.length > 0
        ? scenario.messages
        : [{ role: 'user' as const, content: 'Hello' }]

    for (const msg of baseMessages) messages.push(msg)

    return { instructions: systemPrompt, messages }
  }

  private normalizeScenario(payload: unknown): ScenarioConfig {
    if (Array.isArray(payload)) {
      return {
        name: 'inline',
        messages: payload as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
      }
    }
    if (payload && typeof payload === 'object') {
      const obj = payload as Record<string, unknown>
      if (Array.isArray(obj.messages)) {
        const ctx = (obj.context ?? undefined) as ScenarioConfig['context']
        return {
          name: (obj.name as string) || 'scenario',
          messages: obj.messages as Array<{
            role: 'user' | 'assistant' | 'system'
            content: string
          }>,
          context: ctx,
        }
      }
      if (Array.isArray(obj.conversation)) {
        return {
          name: (obj.name as string) || 'scenario',
          messages: obj.conversation as Array<{
            role: 'user' | 'assistant' | 'system'
            content: string
          }>,
        }
      }
    }
    return { name: 'default', messages: [{ role: 'user', content: 'Hello' }] }
  }

  private rankCandidates(candidates: Candidate[], results: EvaluationResult[]): Candidate[] {
    const candidateScores = new Map<string, number[]>()
    const candidateEfficiencyScores = new Map<string, number[]>()

    for (const result of results) {
      if (!candidateScores.has(result.candidateId)) {
        candidateScores.set(result.candidateId, [])
        candidateEfficiencyScores.set(result.candidateId, [])
      }
      candidateScores.get(result.candidateId)!.push(result.score)
      if (result.efficiencyScore !== undefined) {
        candidateEfficiencyScores.get(result.candidateId)!.push(result.efficiencyScore)
      }
    }

    const candidateAverages = new Map<string, number>()
    const candidateEfficiencyAverages = new Map<string, number>()

    for (const [candidateId, scores] of candidateScores.entries()) {
      const average = scores.reduce((a, b) => a + b, 0) / scores.length
      candidateAverages.set(candidateId, average)

      const efficiencyScores = candidateEfficiencyScores.get(candidateId) || []
      if (efficiencyScores.length > 0) {
        const efficiencyAverage =
          efficiencyScores.reduce((a, b) => a + b, 0) / efficiencyScores.length
        candidateEfficiencyAverages.set(candidateId, efficiencyAverage)
      }
    }

    return candidates.toSorted((a, b) => {
      const scoreA = candidateAverages.get(a.id) || 0
      const scoreB = candidateAverages.get(b.id) || 0

      // Primary sort by quality score
      if (Math.abs(scoreA - scoreB) > 0.1) {
        return scoreB - scoreA
      }

      // Secondary sort by efficiency if scores are close
      const efficiencyA = candidateEfficiencyAverages.get(a.id) || 0
      const efficiencyB = candidateEfficiencyAverages.get(b.id) || 0
      return efficiencyB - efficiencyA
    })
  }

  private calculateDiversity(candidates: Candidate[]): number {
    const componentSets = candidates.map((c) => new Set(c.components))
    let totalSimilarity = 0
    let comparisons = 0

    for (let i = 0; i < componentSets.length; i++) {
      for (let j = i + 1; j < componentSets.length; j++) {
        const set1 = componentSets[i]
        const set2 = componentSets[j]
        if (set1 && set2) {
          const intersection = new Set([...set1].filter((x) => set2.has(x)))
          const union = new Set([...set1, ...set2])
          const jaccard = intersection.size / union.size
          totalSimilarity += jaccard
          comparisons++
        }
      }
    }

    return comparisons > 0 ? 1 - totalSimilarity / comparisons : 0
  }

  private calculateEfficiencyScore(score: number, tokens: number): number {
    // Score per 100 tokens - higher is better
    return (score / tokens) * 100
  }

  private collectFeedback(results: EvaluationResult[]): string[] {
    return results
      .filter((result) => result.score < 9.5) // Only collect feedback from lower-scoring results
      .map((result) => result.feedback)
      .filter((feedback) => feedback.length > 0)
  }

  private findBestCandidate(candidates: Candidate[], results: EvaluationResult[]): Candidate {
    const candidateScores = new Map<string, number[]>()

    for (const result of results) {
      if (!candidateScores.has(result.candidateId)) {
        candidateScores.set(result.candidateId, [])
      }
      candidateScores.get(result.candidateId)!.push(result.score)
    }

    if (candidates.length === 0) {
      throw new Error('No candidates provided')
    }

    let bestCandidate = candidates[0]!
    let bestScore = -1

    for (const candidate of candidates) {
      const scores = candidateScores.get(candidate.id) || []
      if (scores.length > 0) {
        const average = scores.reduce((a, b) => a + b, 0) / scores.length
        if (average > bestScore) {
          bestScore = average
          bestCandidate = candidate
        }
      }
    }

    return bestCandidate
  }

  private aggregateContextScores(results: EvaluationResult[]): {
    scores: Array<{ contextId: string; averageScore: number; count: number }>
    bestContextId: string
  } {
    const map = new Map<string, { sum: number; count: number }>()
    for (const r of results) {
      if (!r.contextId) continue
      const cur = map.get(r.contextId) || { sum: 0, count: 0 }
      cur.sum += r.score
      cur.count += 1
      map.set(r.contextId, cur)
    }
    const scores = Array.from(map.entries()).map(([contextId, { sum, count }]) => ({
      contextId,
      averageScore: sum / count,
      count,
    }))
    scores.sort((a, b) => b.averageScore - a.averageScore)
    return { scores, bestContextId: scores[0]?.contextId || 'n/a' }
  }
}

function generateRunId(): string {
  return Bun.randomUUIDv7()
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Optimization run failed:', error)
    process.exit(1)
  })
}
