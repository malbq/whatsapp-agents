import { ok } from 'node:assert'
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'
import type { Storage } from './storage'

export namespace FilesystemStorage {
  export const storage = (base: string = './storage'): Storage => {
    const fsStorage = createStorage<ArrayBuffer>({
      driver: fsDriver({ base }),
    })
    return {
      store: async ({ key, data, mimeType }) => {
        await fsStorage.setItemRaw(key, data)
        await fsStorage.setMeta(key, { mimeType })
      },

      retrieve: async (key) => {
        const data = await fsStorage.getItemRaw(key)
        ok(data, new Error(`Object not found: ${key}`))

        const meta = await fsStorage.getMeta(key)
        return {
          data,
          mimeType: meta.mimeType as string,
        }
      },
    }
  }
}
