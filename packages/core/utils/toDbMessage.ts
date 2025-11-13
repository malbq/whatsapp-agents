import type { MessageNotification } from '@batman/whatsapp'
import type {
  AssistantModelMessage,
  LanguageModelUsage,
  ToolModelMessage,
  UserModelMessage,
} from 'ai'
import type { GeneratedResponse } from '../ai/generateWhatsappMessage'
import type { DB } from '../infra/db'

export function toDbMessage({
  userId,
  notification,
  userModelMessage,
}: {
  userId: string
  notification: MessageNotification
  userModelMessage: UserModelMessage
}): DB.MessageInsert

export function toDbMessage({
  userId,
  assistantWaMessageId,
  response,
}: {
  userId: string
  assistantWaMessageId?: string
  response: GeneratedResponse
}): DB.MessageInsert[]

export function toDbMessage({
  userId,
  waId,
  type,
  modelMessage,
  usage,
  resourceId,
  timestamp,
}: {
  userId: string
  waId?: string
  type?: DB.MessageType
  modelMessage: UserModelMessage | AssistantModelMessage | ToolModelMessage
  usage?: LanguageModelUsage
  resourceId?: string
  timestamp?: Date
}): DB.MessageInsert

export function toDbMessage({
  userId,
  waId,
  type = 'text',
  modelMessage,
  usage,
  resourceId,
  timestamp,
  notification,
  userModelMessage,
  assistantWaMessageId,
  response,
}: {
  userId: string
  waId?: string
  type?: DB.MessageType
  modelMessage?: UserModelMessage | AssistantModelMessage | ToolModelMessage
  usage?: LanguageModelUsage
  resourceId?: string
  timestamp?: Date
  notification?: MessageNotification
  userModelMessage?: UserModelMessage
  assistantWaMessageId?: string
  response?: GeneratedResponse
}): DB.MessageInsert | DB.MessageInsert[] {
  if (notification && userModelMessage) {
    return {
      userId,
      waId: notification.message.messageId,
      type: notification.message.type,
      modelMessage: userModelMessage,
      timestamp: notification.timestamp,
    }
  }

  if (response) {
    return response.messages.map((msgWithDetails, i, arr) => ({
      userId,
      waId: i === arr.length - 1 ? assistantWaMessageId : undefined,
      type:
        i === arr.length - 1
          ? response.output.type
          : msgWithDetails.modelMessage.role === 'tool'
          ? 'tool-result'
          : 'tool-call',
      modelMessage: msgWithDetails.modelMessage,
      usageInputTokens: msgWithDetails.usage?.inputTokens,
      usageOutputTokens: msgWithDetails.usage?.outputTokens,
      usageTotalTokens: msgWithDetails.usage?.totalTokens,
      usageCachedInputTokens: msgWithDetails.usage?.cachedInputTokens,
      usageReasoningTokens: msgWithDetails.usage?.reasoningTokens,
    })) as DB.MessageInsert[]
  }

  if (!modelMessage) {
    throw new Error('If not notification or response are provided, modelMessage is required')
  }
  return {
    userId,
    waId,
    type,
    modelMessage,
    resourceId,
    usageInputTokens: usage?.inputTokens,
    usageOutputTokens: usage?.outputTokens,
    usageTotalTokens: usage?.totalTokens,
    usageCachedInputTokens: usage?.cachedInputTokens,
    usageReasoningTokens: usage?.reasoningTokens,
    timestamp,
  }
}
