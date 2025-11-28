import type { DB } from '@batman/core/infra/db'
import type { Storage } from '@batman/core/infra/storage'
import type { WebSearch } from '@batman/core/infra/webSearch'
import type { Chat, MessageNotification, OutgoingMessage } from '@batman/whatsapp'
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
  outbound: DB.MessageInsert[]
  responseOutput?: OutgoingMessage
  improvedProfile?: string
}

const asyncLocalStorage = new AsyncLocalStorage<Context>()

export function runContext<T>(
  initContext: Omit<Context, 'outbound'> & { outbound?: Context['outbound'] },
  callback: () => Promise<T>
): Promise<T> {
  return asyncLocalStorage.run(
    {
      ...initContext,
      outbound: initContext.outbound ?? [],
    },
    callback
  )
}

export const getContext = () => {
  const context = asyncLocalStorage.getStore()
  ok(context, 'Context not found')
  return context
}
