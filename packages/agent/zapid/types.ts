import type { DB } from '../../core/infra/db'
import type { Storage } from '../../core/infra/storage'

export interface IncomingMessage {
  externalId: string
  userExternalId: string
  userName: string
  type: 'text' | 'voice' | 'audio' | 'image' | 'document' | 'unsupported'
  text?: string
  mediaData?: ArrayBuffer
  mimeType?: string
  documentFilename?: string
}

export interface Deps {
  db: DB
  storage: Storage
  chat: {
    acknowledgeMessage: (externalId: string) => void
    sendText: (params: { text: string }) => Promise<string>
    sendImage: (params: { storageKey: string; caption?: string }) => Promise<string>
    sendDocument: (params: { storageKey: string; caption?: string; filename?: string }) => Promise<string>
    sendLocation: (params: {
      latitude: number
      longitude: number
      name?: string
      address?: string
    }) => Promise<void>
    sendReaction: (params: { messageId: string; emoji: string }) => Promise<void>
    sendContact: (params: { name: string; phone: string }) => Promise<void>
  }
  ai: {
    respond: (params: {
      messages: Array<{ role: string; content: string | Array<unknown> }>
      tools?: Array<unknown>
    }) => Promise<{ stream: AsyncIterable<string> }>
    transcribeAudio: (params: { audio: ArrayBuffer }) => Promise<string>
    analyzeImage: (params: { imageUrl: string; caption?: string }) => Promise<string>
    transcribeDocument: (params: { document: ArrayBuffer; mimeType: string; filename?: string }) => Promise<string>
    generateEmbeddings: (texts: string[]) => Promise<
      Array<
        Array<{
          content: string
          embedding: number[]
        }>
      >
    >
  }
  webSearch: {
    search: (query: string) => Promise<{
      results: Array<{
        title: string
        url: string
        description: string
      }>
    }>
  }
  googlePlacesApiKey: string
}
