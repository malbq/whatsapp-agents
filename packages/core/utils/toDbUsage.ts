import type { LanguageModelUsage } from 'ai'
import type { DB } from '../infra/db'

export interface ToDbTokenUsageParams {
  messageId: string
  source: DB.UsageSource
  modelMessageIndex?: number
  usage: LanguageModelUsage
}

export function toDbTokenUsage({
  messageId,
  source,
  modelMessageIndex,
  usage,
}: ToDbTokenUsageParams): DB.TokenUsageInsert {
  return {
    messageId,
    source,
    modelMessageIndex: modelMessageIndex ?? null,
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0,
    cachedInputTokens: usage.cachedInputTokens ?? null,
    reasoningTokens: usage.reasoningTokens ?? null,
  }
}
