import type { Storage } from '@batman/core/infra/storage'
import type { WebSearch } from '@batman/core/infra/webSearch'
import type { Chat } from '@batman/whatsapp'
import type { ZapidDB } from './db'

export interface Deps {
  db: ZapidDB
  storage: Storage
  chat: Chat
  webSearch: WebSearch
}
