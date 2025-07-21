import { deepEqual, equal } from 'node:assert/strict'
import path from 'node:path'
import { FilesystemStorage } from '../src/infra/storageFilesystem'

const key = `fs-storage-test-${Date.now()}`
const file = await Bun.file(
  path.join(import.meta.dirname, './storageFilesystem.input.jpg')
)

try {
  await FilesystemStorage.storage.store({
    key,
    data: await file.arrayBuffer(),
    mimeType: file.type,
  })

  const retrieved = await FilesystemStorage.storage.retrieve(key)
  equal(retrieved.mimeType, file.type)
  equal(retrieved.data.byteLength, file.size)
  deepEqual(new Uint8Array(retrieved.data), await file.bytes())
  await Bun.write(
    path.join(import.meta.dirname, 'storageFilesystem.output.jpg'),
    retrieved.data
  )
} finally {
  await Bun.$`rm -rf ./storage/${key}*`
}
