import type { ReasoningPart } from '@ai-sdk/provider-utils'
import type {
  FilePart,
  ImagePart,
  ModelMessage,
  TextPart,
  ToolApprovalRequest,
  ToolCallPart,
  ToolResultPart,
} from 'ai'

export function extractText(message: ModelMessage) {
  switch (message.role) {
    case 'user':
      if (typeof message.content === 'string') {
        return message.content
      }
      return joinText(message.content)
    case 'assistant':
      if (typeof message.content === 'string') {
        return message.content
      } else {
        return joinText(message.content) || undefined
      }
    case 'system':
      return message.content
  }
  return undefined
}

export function joinText(
  content: Array<
    | TextPart
    | ImagePart
    | FilePart
    | ReasoningPart
    | ToolCallPart
    | ToolResultPart
    | ToolApprovalRequest
  >
) {
  return content
    .filter((p) => p.type === 'text')
    .map((p) => p.text)
    .filter(Boolean)
    .join(' ')
}
