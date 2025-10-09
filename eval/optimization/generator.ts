import { readFile } from 'node:fs/promises'
import type { Candidate, ContextPreset, PromptComponent } from './types.js'

// Simple seedable PRNG using Lehmer algorithm (Park and Miller)
class SeededRandom {
  private seed: number

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 2147483647)
  }

  // Returns a random number between 0 (inclusive) and 1 (exclusive)
  random(): number {
    this.seed = (this.seed * 16807) % 2147483647
    return (this.seed - 1) / 2147483646
  }

  // Returns a random integer between 0 (inclusive) and max (exclusive)
  randomInt(max: number): number {
    return Math.floor(this.random() * max)
  }

  // Fisher-Yates shuffle with seeded randomness
  shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.randomInt(i + 1)
      ;[result[i], result[j]] = [result[j]!, result[i]!]
    }
    return result
  }
}

export class PromptGenerator {
  private components: PromptComponent[] = []
  private componentsByCategory: Record<string, PromptComponent[]> = {}
  private rng: SeededRandom
  private contextPresets: ContextPreset[] = []

  constructor(seed?: number) {
    this.rng = new SeededRandom(seed)
  }

  async loadComponents(configPath = 'eval/optimization/components.json'): Promise<void> {
    const content = await readFile(configPath, 'utf-8')
    const config = JSON.parse(content) as { components: PromptComponent[] }
    this.components = config.components

    this.componentsByCategory = this.components.reduce((acc, component) => {
      if (!acc[component.category]) {
        acc[component.category] = []
      }
      acc[component.category]!.push(component)
      return acc
    }, {} as Record<string, PromptComponent[]>)

    this.contextPresets = this.buildDefaultContextPresets()
  }

  getContextPresets(): ContextPreset[] {
    return this.contextPresets
  }

  generateSeedCandidates(targetPopulationSize = 8): Candidate[] {
    const baseComponents = [
      'core_identity__v2',
      'core_capabilities__v2',
      'whatsapp_context__v2',
      'length_constraint__v2',
      'conciseness_style__v2',
      'context_usage__v2',
      'language_matching__v2',
      'accuracy_focus__v2',
      'privacy_awareness__v2',
      'helpful_tone__v2',
      'task_efficiency__v2',
    ]

    const variants = [
      {
        id: 'baseline',
        components: baseComponents,
        notes: 'Baseline with v2 core components',
      },
      {
        id: 'detailed',
        components: [
          ...baseComponents,
          'embedding_optimization__v2',
          'formatting_guidelines__v2',
          'whatsapp_formatting__v2',
          'context_integration__v2',
          'personalization_enhance__v2',
        ],
        notes: 'Detailed version with v2 formatting, embedding, and personalization',
      },
      {
        id: 'minimal',
        components: [
          'core_identity__v2',
          'length_constraint__v2',
          'conciseness_style__v2',
          'context_usage__v2',
        ],
        notes: 'Minimal version with only essential v2 components',
      },
      {
        id: 'privacy_focused',
        components: [
          ...baseComponents,
          'privacy_awareness__v2',
          'accuracy_focus__v2',
          'error_handling__v2',
        ],
        notes: 'Privacy-focused version with v2 accuracy and error handling',
      },
      {
        id: 'efficiency_focused',
        components: [
          ...baseComponents,
          'task_efficiency__v2',
          'helpful_tone__v2',
          'clarification_style__v2',
        ],
        notes: 'Efficiency-focused version with v2 helpful tone and clarification',
      },
      {
        id: 'context_rich',
        components: [
          ...baseComponents,
          'context_integration__v2',
          'personalization_enhance__v2',
          'response_pacing__v2',
        ],
        notes: 'Context-rich version with v2 integration and personalization',
      },
    ]

    const candidates = variants.map((variant) => ({
      id: variant.id,
      components: variant.components,
      fullPrompt: this.buildPrompt(variant.components),
      generation: 0,
      notes: variant.notes,
      createdAt: new Date(),
    }))

    const seenSignatures = new Set<string>()
    // Track signatures of predefined variants
    for (const candidate of candidates) {
      seenSignatures.add(this.getComponentSignature(candidate.components))
    }

    // Fill remaining slots with random variants (ensuring uniqueness)
    let attempts = 0
    const maxAttempts = targetPopulationSize * 10

    while (candidates.length < targetPopulationSize && attempts < maxAttempts) {
      attempts++
      const randomComponents = this.generateRandomComponentSet(baseComponents)
      const signature = this.getComponentSignature(randomComponents)

      if (!seenSignatures.has(signature)) {
        const id = `seed_random_${candidates.length}`

        candidates.push({
          id,
          components: randomComponents,
          fullPrompt: this.buildPrompt(randomComponents),
          generation: 0,
          notes: 'Random seed variant',
          createdAt: new Date(),
        })
        seenSignatures.add(signature)
      }
    }

    return candidates
  }

  private generateRandomComponentSet(baseComponents: string[]): string[] {
    // Start with a subset of base components (ensure at least core_identity__v2)
    const mandatoryComponents = ['core_identity__v2']
    const optionalBaseComponents = baseComponents.filter((c) => !mandatoryComponents.includes(c))

    // Randomly select 3-6 base components
    const selectedBase = mandatoryComponents.concat(
      this.rng.shuffle(optionalBaseComponents).slice(0, this.rng.randomInt(4) + 2) // 2-5 additional components
    )

    // Add 0-3 random other components
    const availableComponents = this.components.map((c) => c.id)
    const otherComponents = this.rng
      .shuffle(availableComponents.filter((c) => !selectedBase.includes(c)))
      .slice(0, this.rng.randomInt(4)) // 0-3 additional components

    return [...selectedBase, ...otherComponents]
  }

  buildPrompt(componentIds: string[]): string {
    const selectedComponents = componentIds
      .map((id) => this.components.find((c) => c.id === id))
      .filter((c): c is PromptComponent => c !== undefined)

    const coreComponents = selectedComponents.filter((c) => c.category === 'core')
    const styleComponents = selectedComponents.filter((c) => c.category === 'style')
    const constraintComponents = selectedComponents.filter((c) => c.category === 'constraint')
    const exampleComponents = selectedComponents.filter((c) => c.category === 'example')

    let prompt = ''

    if (coreComponents.length > 0) {
      prompt += coreComponents.map((c) => c.content).join('\n') + '\n'
    }

    if (styleComponents.length > 0 || constraintComponents.length > 0) {
      prompt += '# Guidelines\n'
      ;[...constraintComponents, ...styleComponents].forEach((c) => {
        prompt += `- ${c.content}\n`
      })
    }

    if (exampleComponents.length > 0) {
      prompt += exampleComponents.map((c) => c.content).join('\n')
    }

    return prompt.trim()
  }

  crossover(parent1: Candidate, parent2: Candidate, generation: number): Candidate {
    const combinedComponents = [...new Set([...parent1.components, ...parent2.components])]

    const componentPool = combinedComponents.filter(() => this.rng.random() > 0.3)

    if (componentPool.length === 0) {
      componentPool.push(...parent1.components.slice(0, 3))
    }

    const id = `gen${generation}_cross_${Date.now()}_${this.rng.randomInt(10000).toString(36)}`

    return {
      id,
      components: componentPool,
      fullPrompt: this.buildPrompt(componentPool),
      parentId: `${parent1.id}+${parent2.id}`,
      generation,
      notes: `Crossover of ${parent1.id} and ${parent2.id}`,
      createdAt: new Date(),
    }
  }

  mutate(parent: Candidate, generation: number, feedback?: string): Candidate {
    let components = [...parent.components]
    const availableComponents = this.components.map((c) => c.id)

    if (feedback) {
      components = this.applyFeedbackMutation(components, feedback)
    } else {
      components = this.applyRandomMutation(components, availableComponents)
    }

    const id = `gen${generation}_mut_${Date.now()}_${this.rng.randomInt(10000).toString(36)}`

    return {
      id,
      components,
      fullPrompt: this.buildPrompt(components),
      parentId: parent.id,
      generation,
      notes: feedback ? `Feedback-based mutation: ${feedback.slice(0, 50)}...` : 'Random mutation',
      createdAt: new Date(),
    }
  }

  private applyRandomMutation(components: string[], availableComponents: string[]): string[] {
    const mutationType = this.rng.random()

    if (mutationType < 0.4 && components.length > 2) {
      const removeIndex = this.rng.randomInt(components.length)
      return components.filter((_, i) => i !== removeIndex)
    } else if (mutationType < 0.8) {
      const unusedComponents = availableComponents.filter((c) => !components.includes(c))
      if (unusedComponents.length > 0) {
        const addComponent = unusedComponents[this.rng.randomInt(unusedComponents.length)]!
        return [...components, addComponent]
      }
    } else {
      const replaceIndex = this.rng.randomInt(components.length)
      const unusedComponents = availableComponents.filter((c) => !components.includes(c))
      if (unusedComponents.length > 0) {
        const newComponent = unusedComponents[this.rng.randomInt(unusedComponents.length)]!
        const newComponents = [...components]
        newComponents[replaceIndex] = newComponent
        return newComponents
      }
    }

    return components
  }

  private applyFeedbackMutation(components: string[], feedback: string): string[] {
    const lowerFeedback = feedback.toLowerCase()

    if (lowerFeedback.includes('concise') || lowerFeedback.includes('shorter')) {
      return components.filter(
        (id) => !['whatsapp_formatting', 'formatting_guidelines'].includes(id)
      )
    }

    if (lowerFeedback.includes('detailed') || lowerFeedback.includes('more information')) {
      const toAdd = ['embedding_optimization', 'accuracy_focus', 'context_integration'].filter(
        (id) => !components.includes(id)
      )
      return [...components, ...toAdd.slice(0, 2)]
    }

    if (lowerFeedback.includes('helpful') || lowerFeedback.includes('friendly')) {
      if (!components.includes('helpful_tone')) {
        return [...components, 'helpful_tone']
      }
    }

    if (lowerFeedback.includes('privacy') || lowerFeedback.includes('personal')) {
      if (!components.includes('privacy_awareness')) {
        return [...components, 'privacy_awareness']
      }
    }

    if (lowerFeedback.includes('format') || lowerFeedback.includes('structure')) {
      const formatComponents = ['formatting_guidelines', 'whatsapp_formatting'].filter(
        (id) => !components.includes(id)
      )
      return [...components, ...formatComponents]
    }

    return this.applyRandomMutation(
      components,
      this.components.map((c) => c.id)
    )
  }

  generateVariants(
    parents: Candidate[],
    populationSize: number,
    generation: number,
    options: {
      crossoverRate: number
      eliteSize: number
      mutationRate: number
      feedback?: string[]
    }
  ): Candidate[] {
    const variants: Candidate[] = []
    const eliteCount = Math.max(1, Math.floor(parents.length * options.eliteSize))
    const seenSignatures = new Set<string>()

    // Add elite candidates and track their signatures
    const eliteCandidates = parents.slice(0, eliteCount)
    for (const candidate of eliteCandidates) {
      variants.push(candidate)
      seenSignatures.add(this.getComponentSignature(candidate.components))
    }

    let attempts = 0
    const maxAttempts = populationSize * 10 // Prevent infinite loops

    while (variants.length < populationSize && attempts < maxAttempts) {
      attempts++

      const parent1 = parents[this.rng.randomInt(Math.min(5, parents.length))]!
      const parent2 = parents[this.rng.randomInt(Math.min(5, parents.length))]!

      let newCandidate: Candidate

      if (this.rng.random() < options.crossoverRate) {
        newCandidate = this.crossover(parent1, parent2, generation)
      } else {
        const parentToMutate = this.rng.random() < 0.5 ? parent1 : parent2
        const feedback = options.feedback?.length
          ? options.feedback[this.rng.randomInt(options.feedback.length)]
          : undefined
        newCandidate = this.mutate(parentToMutate, generation, feedback)
      }

      const signature = this.getComponentSignature(newCandidate.components)
      if (!seenSignatures.has(signature)) {
        variants.push(newCandidate)
        seenSignatures.add(signature)
      }
    }

    // If we couldn't generate enough unique candidates, fill with random variants
    while (variants.length < populationSize) {
      const randomComponents = this.generateRandomComponentSet(['core_identity__v2'])
      const signature = this.getComponentSignature(randomComponents)

      if (!seenSignatures.has(signature)) {
        const id = `gen${generation}_random_${Date.now()}_${this.rng.randomInt(10000).toString(36)}`
        const randomCandidate: Candidate = {
          id,
          components: randomComponents,
          fullPrompt: this.buildPrompt(randomComponents),
          generation,
          notes: 'Random variant (deduplication fallback)',
          createdAt: new Date(),
        }
        variants.push(randomCandidate)
        seenSignatures.add(signature)
      }
    }

    return variants.slice(0, populationSize)
  }

  private getComponentSignature(components: string[]): string {
    // Create a consistent signature by sorting component IDs
    return components.slice().toSorted().join('|')
  }

  private buildDefaultContextPresets(): ContextPreset[] {
    const presets: ContextPreset[] = [
      {
        id: 'ctx_all',
        name: 'All context included',
        config: {
          includeUserProfile: true,
          includeSimilarMessages: true,
          includeRecentThreadDisclaimer: true,
          includeMediaDisclaimers: true,
        },
      },
      {
        id: 'ctx_no_profile',
        name: 'No user profile',
        config: {
          includeUserProfile: false,
          includeSimilarMessages: true,
          includeRecentThreadDisclaimer: true,
          includeMediaDisclaimers: true,
        },
      },
      {
        id: 'ctx_no_similar',
        name: 'No similar messages',
        config: {
          includeUserProfile: true,
          includeSimilarMessages: false,
          includeRecentThreadDisclaimer: true,
          includeMediaDisclaimers: true,
        },
      },
      {
        id: 'ctx_minimal',
        name: 'Minimal context',
        config: {
          includeUserProfile: false,
          includeSimilarMessages: false,
          includeRecentThreadDisclaimer: false,
          includeMediaDisclaimers: false,
        },
      },
      {
        id: 'ctx_no_disclaimers',
        name: 'No disclaimers',
        config: {
          includeUserProfile: true,
          includeSimilarMessages: true,
          includeRecentThreadDisclaimer: false,
          includeMediaDisclaimers: false,
        },
      },
    ]
    return presets
  }
}
