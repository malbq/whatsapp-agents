import type { LanguageModelUsage } from 'ai'

export function formatTokenUsage(usage: LanguageModelUsage) {
  return { total: usage.totalTokens, input: usage.inputTokens, output: usage.outputTokens }
}
