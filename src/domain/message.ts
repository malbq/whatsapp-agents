export type MessageType =
  | 'text'
  | 'voice'
  | 'audio'
  | 'document'
  | 'image'
  | 'unsupported'

export type Message =
  | TextMessage
  | VoiceMessage
  | AudioMessage
  | DocumentMessage
  | ImageMessage
  | UnsupportedMessage

export interface MessageBase {
  id?: string
  role: 'user' | 'agent'
  type: MessageType
  from: string
  to: string
  timestamp?: string
}

export interface UnsupportedMessage extends MessageBase {
  type: 'unsupported'
  unsupportedType: string
}

export interface TextMessage extends MessageBase {
  type: 'text'
  body: string
}

export interface VoiceMessage extends MessageBase {
  type: 'voice'
  mediaId: string
  mimeType: string
}

export interface AudioMessage extends MessageBase {
  type: 'audio'
  mediaId: string
  mimeType: string
}

export interface DocumentMessage extends MessageBase {
  type: 'document'
  mediaId: string
  mimeType: string
  filename: string
}

export interface ImageMessage extends MessageBase {
  type: 'image'
  mediaId: string
  mimeType: string
  caption?: string
}

export type StatusUpdate = {
  status: 'read' | 'delivered' | 'sent'
}
