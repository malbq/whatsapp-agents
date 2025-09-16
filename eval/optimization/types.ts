export interface PromptComponent {
  id: string
  name: string
  content: string
  category: 'core' | 'style' | 'constraint' | 'example'
}

export interface ScenarioConfig {
  name: string
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  context?: ScenarioContext
}

export interface ScenarioContext {
  profile?: string
  similarMessages?: ScenarioSimilarMessage[]
  recentMessages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  inboundType?: 'text' | 'audio' | 'image' | 'document'
  filename?: string
  fileSearchResults?: Array<{
    storageKey: string
    score: number
    snippet: string
    timestamp: string | Date
  }>
}

export interface ScenarioSimilarMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string | Date
  chunkSequence?: number
  totalChunks?: number
}

export interface Candidate {
  id: string
  components: string[]
  fullPrompt: string
  parentId?: string
  generation: number
  notes?: string
  createdAt: Date
}

export interface EvaluationResult {
  candidateId: string
  scenarioId: string
  contextId?: string
  score: number
  feedback: string
  criteria: {
    relevance: number
    coherence: number
    conciseness: number
    helpfulness: number
    accuracy: number
  }
  usage: {
    tokens: number
  }
  efficiencyScore?: number // score per 100 tokens
  response: string // The assistant's final response
  timestamp: Date
}

export interface OptimizationRun {
  runId: string
  startTime: Date
  endTime?: Date
  scenarios: string[]
  generations: number
  populationSize: number
  bestCandidateId?: string
  config: {
    mutationRate: number
    crossoverRate: number
    eliteSize: number
  }
}

export interface RunSummary {
  runId: string
  bestCandidate: Candidate
  bestScore: number
  averageScore: number
  totalEvaluations: number
  totalTokens: number
  generationStats: Array<{
    generation: number
    bestScore: number
    averageScore: number
    diversity: number
  }>
  contextScores: Array<{ contextId: string; averageScore: number; count: number }>
  bestContextId: string
}

export interface ContextConfig {
  includeUserProfile: boolean
  includeSimilarMessages: boolean
  includeRecentThreadDisclaimer: boolean
  includeMediaDisclaimers: boolean
}

export interface ContextPreset {
  id: string
  name: string
  config: ContextConfig
}
