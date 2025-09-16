import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Candidate, EvaluationResult, OptimizationRun, RunSummary } from './types.js'

const OPTIMIZATION_DIR = 'optimization/reports'

export class OptimizationStorage {
  private runDir: string

  constructor(runId: string) {
    this.runDir = join(OPTIMIZATION_DIR, runId)
  }

  async ensureRunDir(): Promise<void> {
    await mkdir(this.runDir, { recursive: true })
  }

  async saveCandidate(candidate: Candidate): Promise<void> {
    await this.ensureRunDir()
    const candidatesDir = join(this.runDir, 'candidates')
    await mkdir(candidatesDir, { recursive: true })

    const filePath = join(candidatesDir, `${candidate.id}.json`)
    await writeFile(filePath, JSON.stringify(candidate, null, 2))
  }

  async loadCandidate(candidateId: string): Promise<Candidate | null> {
    try {
      const filePath = join(this.runDir, 'candidates', `${candidateId}.json`)
      const content = await readFile(filePath, 'utf-8')
      const candidate = JSON.parse(content) as Candidate
      candidate.createdAt = new Date(candidate.createdAt)
      return candidate
    } catch {
      return null
    }
  }

  async loadCandidates(): Promise<Candidate[]> {
    try {
      const candidatesDir = join(this.runDir, 'candidates')
      const files = await readdir(candidatesDir)
      const candidates: Candidate[] = []

      for (const file of files) {
        if (file.endsWith('.json')) {
          const candidateId = file.replace('.json', '')
          const candidate = await this.loadCandidate(candidateId)
          if (candidate) {
            candidates.push(candidate)
          }
        }
      }

      return candidates.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    } catch {
      return []
    }
  }

  async saveResult(result: EvaluationResult): Promise<void> {
    await this.ensureRunDir()
    const resultsDir = join(this.runDir, 'results')
    await mkdir(resultsDir, { recursive: true })

    const fileName = `${result.candidateId}_${result.scenarioId}${
      result.contextId ? `_${result.contextId}` : ''
    }.json`
    const filePath = join(resultsDir, fileName)
    await writeFile(filePath, JSON.stringify(result, null, 2))
  }

  async getResultsForCandidate(candidateId: string): Promise<EvaluationResult[]> {
    try {
      const resultsDir = join(this.runDir, 'results')
      const files = await readdir(resultsDir)
      const results: EvaluationResult[] = []

      for (const file of files) {
        if (file.startsWith(`${candidateId}_`) && file.endsWith('.json')) {
          const content = await readFile(join(resultsDir, file), 'utf-8')
          const result = JSON.parse(content) as EvaluationResult
          result.timestamp = new Date(result.timestamp)
          results.push(result)
        }
      }

      return results
    } catch {
      return []
    }
  }

  async getAllResults(): Promise<EvaluationResult[]> {
    try {
      const resultsDir = join(this.runDir, 'results')
      const files = await readdir(resultsDir)
      const results: EvaluationResult[] = []

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await readFile(join(resultsDir, file), 'utf-8')
          const result = JSON.parse(content) as EvaluationResult
          result.timestamp = new Date(result.timestamp)
          results.push(result)
        }
      }

      return results
    } catch {
      return []
    }
  }

  async saveRun(run: OptimizationRun): Promise<void> {
    await this.ensureRunDir()
    const filePath = join(this.runDir, 'run.json')
    await writeFile(filePath, JSON.stringify(run, null, 2))
  }

  async loadRun(): Promise<OptimizationRun | null> {
    try {
      const filePath = join(this.runDir, 'run.json')
      const content = await readFile(filePath, 'utf-8')
      const run = JSON.parse(content) as OptimizationRun
      run.startTime = new Date(run.startTime)
      if (run.endTime) {
        run.endTime = new Date(run.endTime)
      }
      return run
    } catch {
      return null
    }
  }

  async saveSummary(summary: RunSummary): Promise<void> {
    await this.ensureRunDir()
    const filePath = join(this.runDir, 'summary.json')
    await writeFile(filePath, JSON.stringify(summary, null, 2))
  }

  async loadSummary(): Promise<RunSummary | null> {
    try {
      const filePath = join(this.runDir, 'summary.json')
      const content = await readFile(filePath, 'utf-8')
      return JSON.parse(content) as RunSummary
    } catch {
      return null
    }
  }

  static async listRuns(): Promise<string[]> {
    try {
      const entries = await readdir(OPTIMIZATION_DIR)
      const runs: string[] = []

      for (const entry of entries) {
        const entryPath = join(OPTIMIZATION_DIR, entry)
        const stats = await stat(entryPath)
        if (stats.isDirectory() && entry !== 'node_modules' && !entry.startsWith('.')) {
          runs.push(entry)
        }
      }

      return runs.sort()
    } catch {
      return []
    }
  }
}
