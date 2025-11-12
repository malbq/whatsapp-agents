import type {
  AssistantModelMessage,
  LanguageModelUsage,
  ToolModelMessage,
  UserModelMessage,
} from 'ai'
import type { DB } from '../infra/db'

export function toDbMessage({
  userId,
  waId,
  type = 'text',
  modelMessage,
  usage,
  resourceId,
}: {
  userId: string
  waId?: string
  type?: DB.MessageType
  modelMessage: UserModelMessage | AssistantModelMessage | ToolModelMessage
  usage?: LanguageModelUsage
  resourceId?: string
}): Omit<DB.Message, 'id' | 'timestamp'> {
  return {
    userId,
    waId: waId ?? null,
    type,
    modelMessage,
    resourceId: resourceId ?? null,
    usageInputTokens: usage?.inputTokens ?? null,
    usageOutputTokens: usage?.outputTokens ?? null,
    usageTotalTokens: usage?.totalTokens ?? null,
    usageCachedInputTokens: usage?.cachedInputTokens ?? null,
    usageReasoningTokens: usage?.reasoningTokens ?? null,
  }
}
