import { openai } from '@ai-sdk/openai'
import { generateObject, type LanguageModel } from 'ai'
import { z } from 'zod'
import type { EvaluationResult } from './types.js'

const JudgmentSchema = z.object({
  score: z.number().min(0).max(10),
  feedback: z.string(),
  criteria: z.object({
    relevance: z.number().min(0).max(10),
    coherence: z.number().min(0).max(10),
    conciseness: z.number().min(0).max(10),
    helpfulness: z.number().min(0).max(10),
    accuracy: z.number().min(0).max(10),
  }),
})

const formatMessageThread = (
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
) => messages.map((msg) => `[${msg.role.toUpperCase()}]: ${msg.content}`).join('\n\n')

export class Judge {
  private model: LanguageModel

  constructor() {
    this.model = openai('gpt-5-2025-08-07')
  }

  async evaluate(
    candidateId: string,
    scenarioId: string,
    prompt: string,
    response: string,
    messageThread: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
  ): Promise<EvaluationResult> {
    const systemPrompt = `You are an expert evaluator of AI assistant prompts and responses. Your task is to score how well a response demonstrates the qualities defined in the system prompt, considering the full conversation context.

Evaluate the response on these criteria (0-10 scale):
- Relevance: How well does the response address the user's request within the conversation context?
- Coherence: Is the response logical, well-structured, and consistent with the conversation flow?
- Conciseness: Is the response appropriately brief without losing important information?
- Helpfulness: How useful and actionable is the response for the user given the conversation history?
- Accuracy: Is the information provided correct and reliable, considering previous context?

Consider the entire message thread when evaluating. A good response should:
- Build appropriately on previous exchanges
- Maintain consistency with earlier statements
- Address follow-up questions or clarifications effectively
- Show awareness of the conversation's progression

Provide an overall score (0-10) and detailed feedback explaining your evaluation.`

    const userPrompt = `System Prompt Being Evaluated:
"""
${prompt}
"""

Message Thread Context:
"""
${formatMessageThread(messageThread)}
"""

AI Response to Evaluate:
"""
${response}
"""

Please evaluate this response according to the criteria above, considering the full conversation context.`

    try {
      const result = await generateObject({
        model: this.model,
        system: systemPrompt,
        prompt: userPrompt,
        schema: JudgmentSchema,
        providerOptions: {
          openai: {
            reasoningEffort: 'high',
          },
        },
      })
      const judgment = result.object as z.infer<typeof JudgmentSchema>

      return {
        candidateId,
        scenarioId,
        score: judgment.score,
        feedback: judgment.feedback,
        criteria: judgment.criteria,
        usage: {
          tokens: result.usage?.totalTokens ?? 0,
        },
        response,
        timestamp: new Date(),
      }
    } catch (error) {
      return {
        candidateId,
        scenarioId,
        score: 0,
        feedback: `Evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        criteria: {
          relevance: 0,
          coherence: 0,
          conciseness: 0,
          helpfulness: 0,
          accuracy: 0,
        },
        usage: {
          tokens: 0,
        },
        response,
        timestamp: new Date(),
      }
    }
  }
}
