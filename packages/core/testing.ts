/**
 * Offline test doubles for agents: no network, no API keys.
 */
import type { Chat } from '@wa/whatsapp'
import { MockEmbeddingModelV4, MockLanguageModelV4 } from 'ai/test'
import type { GeneratedWhatsappMessage } from './ai/generateWhatsappMessage'
import { FileRetrievalError } from './errors'
import type { Storage } from './infra/storage'

type SendMethod = Exclude<
  keyof Chat,
  'parseNotification' | 'acknowledgeMessage' | 'sendTypingIndicator'
>

export interface SentMessage {
  method: SendMethod
  userId: string
  message: unknown
}

export interface RecordingChat extends Chat {
  sent: SentMessage[]
}

/** Chat that records every outgoing message instead of calling the WhatsApp API */
export function createRecordingChat(): RecordingChat {
  const sent: SentMessage[] = []
  const record =
    (method: SendMethod) =>
    async (userId: string, message: unknown): Promise<string> => {
      sent.push({ method, userId, message })
      return `wamid.out.${sent.length}`
    }

  return {
    sent,
    parseNotification: async () => null,
    acknowledgeMessage: async () => {},
    sendTypingIndicator: async () => {},
    sendText: record('sendText'),
    sendImage: record('sendImage'),
    sendDocument: record('sendDocument'),
    sendLocation: record('sendLocation'),
    sendReaction: record('sendReaction'),
    sendContact: record('sendContact'),
    sendInteractiveList: record('sendInteractiveList'),
    sendInteractiveButton: record('sendInteractiveButton'),
    sendInteractiveCtaUrl: record('sendInteractiveCtaUrl'),
    sendTemplate: record('sendTemplate'),
  }
}

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
}

/** Language model that answers with plain text, one result per call */
export function mockTextModel(...texts: string[]): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: texts.map((text) => ({
      content: [{ type: 'text', text }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage,
      warnings: [],
    })),
  })
}

/** Language model that answers `generateWhatsappMessage` calls with the given messages, in order */
export function mockWhatsappModel(...messages: GeneratedWhatsappMessage[]): MockLanguageModelV4 {
  return mockTextModel(...messages.map((message) => JSON.stringify({ message })))
}

/** Embedding model returning deterministic vectors of the given size */
export function mockEmbeddingModel(dimensions = 768): MockEmbeddingModelV4 {
  return new MockEmbeddingModelV4({
    doEmbed: async ({ values }) => ({
      embeddings: values.map((_, i) =>
        Array.from({ length: dimensions }, (__, d) => ((i + d) % 7) / 7)
      ),
      warnings: [],
    }),
  })
}

export function createMemoryStorage(): Storage {
  const objects = new Map<string, { data: ArrayBuffer; mimeType: string }>()
  return {
    store: async ({ key, data, mimeType }) => {
      objects.set(key, { data, mimeType })
    },
    retrieve: async (key) => {
      const object = objects.get(key)
      if (!object) throw new FileRetrievalError(`Object not found: ${key}`)
      return object
    },
  }
}
