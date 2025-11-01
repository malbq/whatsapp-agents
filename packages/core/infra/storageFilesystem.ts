import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'
import type { Storage } from './storage'

export namespace FilesystemStorage {
  export const storage = (base: string = './storage'): Storage => {
    const fsStorage = createStorage<ArrayBuffer>({
      driver: fsDriver({ base }),
    })
    return {
      store: async ({ key, data, mimeType, filename }) => {
        await fsStorage.setItemRaw(key, data)
        await fsStorage.setMeta(key, { mimeType, filename })
      },

      retrieve: async (key) => {
        const data = await fsStorage.getItemRaw(key)
        if (!data) {
          throw new Error(`Object not found: ${key}`)
        }

        const meta = await fsStorage.getMeta(key)
        return {
          data,
          mimeType: meta.mimeType as string,
          filename: meta.filename as string | undefined,
        }
      },
    }
  }
}
