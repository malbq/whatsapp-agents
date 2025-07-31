import type { LanguageModelUsage } from 'ai'

export function formatTokenUsage(usage: LanguageModelUsage) {
  return `tokens: ${usage.totalTokens} = in:${usage.inputTokens} out:${usage.outputTokens}`
}
