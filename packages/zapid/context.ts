import type { Storage } from '@wa/core/infra/storage'
import type { WebSearch } from '@wa/core/infra/webSearch'
import type { AssistantTurnResult } from '@wa/core/utils/toDbMessage'
import type { Chat, MessageNotification, OutgoingMessage } from '@wa/whatsapp'
import { ok } from 'node:assert'
import { AsyncLocalStorage } from 'node:async_hooks'
import type { UserEntitlements, UserWithProfile, ZapidRepository } from './db'

type Context = {
  notification: MessageNotification
  db: ZapidRepository
  storage: Storage
  chat: Chat
  webSearch: WebSearch
  user: UserWithProfile
  entitlements: UserEntitlements
  outbound?: AssistantTurnResult
  responseOutput?: OutgoingMessage
  improvedProfile?: string
  abortSignal: AbortSignal
}

const asyncLocalStorage = new AsyncLocalStorage<Context>()
const activeGenerations = new Map<string, AbortController>()

export function runContext<T>(
  initContext: Omit<Context, 'outbound' | 'abortSignal'>,
  callback: () => Promise<T>
): Promise<T> {
  const userId = initContext.user.id

  const existing = activeGenerations.get(userId)
  if (existing) {
    console.debug(`Aborting in-flight generation`)
    existing.abort()
  }

  const abortController = new AbortController()
  activeGenerations.set(userId, abortController)

  return asyncLocalStorage
    .run(
      {
        ...initContext,
        abortSignal: abortController.signal,
      },
      callback
    )
    .finally(() => {
      if (activeGenerations.get(userId) === abortController) {
        activeGenerations.delete(userId)
      }
    })
}

export function getContext() {
  const context = asyncLocalStorage.getStore()
  ok(context, 'Context not found')
  return context
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
