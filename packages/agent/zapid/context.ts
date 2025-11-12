import type { MessageNotification } from '@batman/whatsapp'
import { ok } from 'node:assert'
import { AsyncLocalStorage } from 'node:async_hooks'

type Context = MessageNotification

const asyncLocalStorage = new AsyncLocalStorage<Context>()

export function runContext<T>(context: Context, callback: () => Promise<T>): Promise<T> {
  return asyncLocalStorage.run(context, callback)
}

export const getContext = () => {
  const context = asyncLocalStorage.getStore()
  ok(context, 'Context not found')
  return context
}
