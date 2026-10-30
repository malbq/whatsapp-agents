import type { ModelMessage, TextPart } from 'ai'

type ContentPart = Exclude<ModelMessage['content'], string>[number]

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

export function joinText(content: ContentPart[]) {
  return content
    .filter((p): p is TextPart => p.type === 'text')
    .map((p) => p.text)
    .filter(Boolean)
    .join(' ')
}
