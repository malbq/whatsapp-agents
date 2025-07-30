export type MessageType = 'text' | 'voice' | 'audio' | 'document' | 'image' | 'unsupported'

export type MessageRole = 'user' | 'assistant' | 'system'

export type StatusUpdate = {
  status: 'read' | 'delivered' | 'sent'
}
