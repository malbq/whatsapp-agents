import type { MessageNotification } from '@batman/whatsapp'
import type {
  AssistantModelMessage,
  LanguageModelUsage,
  ToolModelMessage,
  UserModelMessage,
} from 'ai'
import type { GeneratedResponse } from '../ai/generateWhatsappMessage'
import type { DB } from '../infra/db'

export interface AssistantTurnResult {
  message: DB.MessageInsert
  usages: Array<{
    source: DB.UsageSource
    modelMessageIndex: number
    usage: LanguageModelUsage
  }>
}

/**
 * Convert inbound user notification to DB message insert.
 * User messages contain a single element in the messages array.
 */
export function toDbMessage({
  userId,
  notification,
  modelMessage,
}: {
  userId: string
  notification: MessageNotification
  modelMessage: UserModelMessage
}): DB.MessageInsert

/**
 * Convert assistant response to a single bundled DB message insert.
 * All tool calls, tool results, and the final response are bundled into one row.
 * Returns the message insert and associated usage records.
 */
export function toDbMessage({
  userId,
  assistantWaMessageId,
  response,
}: {
  userId: string
  assistantWaMessageId?: string
  response: GeneratedResponse
}): AssistantTurnResult

/**
 * Generic message insert with optional usage tracking.
 * Messages array contains a single element.
 */
export function toDbMessage({
  userId,
  waId,
  type,
  modelMessage,
  resourceId,
  timestamp,
}: {
  userId: string
  waId?: string
  type?: DB.MessageType
  modelMessage: UserModelMessage | AssistantModelMessage | ToolModelMessage
  resourceId?: string
  timestamp?: Date
}): DB.MessageInsert

export function toDbMessage({
  userId,
  waId,
  type = 'text',
  modelMessage,
  resourceId,
  timestamp,
  notification,
  assistantWaMessageId,
  response,
}: {
  userId: string
  waId?: string
  type?: DB.MessageType
  modelMessage?: UserModelMessage | AssistantModelMessage | ToolModelMessage
  resourceId?: string
  timestamp?: Date
  notification?: MessageNotification
  assistantWaMessageId?: string
  response?: GeneratedResponse
}): DB.MessageInsert | AssistantTurnResult {
  // Inbound user message from notification
  if (notification && modelMessage) {
    return {
      userId,
      waId: notification.message.messageWaId,
      type: notification.message.type,
      role: modelMessage.role as DB.MessageRole,
      messages: [modelMessage],
      timestamp: notification.timestamp,
    } satisfies DB.MessageInsert
  }

  // Assistant turn with bundled messages
  if (response) {
    const messages = response.messages.map((m) => m.modelMessage)
    const usages: AssistantTurnResult['usages'] = []

    response.messages.forEach((msgWithDetails, index) => {
      if (!msgWithDetails.usage) return

      // Determine usage source based on message role and position
      const isLastMessage = index === response.messages.length - 1
      const source: DB.UsageSource =
        isLastMessage && msgWithDetails.modelMessage.role === 'assistant'
          ? 'assistant_response'
          : 'tool_call'

      // Only track usage for assistant messages (not tool results)
      if (msgWithDetails.modelMessage.role === 'assistant') {
        usages.push({
          source,
          modelMessageIndex: index,
          usage: msgWithDetails.usage,
        })
      }
    })

    return {
      message: {
        userId,
        waId: assistantWaMessageId,
        type: response.output.type,
        role: 'assistant',
        messages,
      } satisfies DB.MessageInsert,
      usages,
    }
  }

  // Generic single message
  if (!modelMessage) {
    throw new Error('If notification or response are not provided, modelMessage is required')
  }

  return {
    userId,
    waId,
    type,
    role: modelMessage.role as DB.MessageRole,
    messages: [modelMessage],
    resourceId,
    timestamp,
  } satisfies DB.MessageInsert
}
