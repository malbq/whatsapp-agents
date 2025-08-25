import { getLogger } from '@logtape/logtape'
import { ComponentNotFoundError } from '../../errors'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'retrieveFile'])

export async function RetrieveFileSystem(frame: Frame, deps: Deps) {
  const userComponent = frame.getComponent(frame.USER_ENTITY_ID, 'User')
  if (!userComponent) throw new ComponentNotFoundError(frame.USER_ENTITY_ID, 'User')

  const pendingStorageKeys = getPendingFileRetrievals(userComponent.id)

  if (pendingStorageKeys.length === 0) {
    return
  }

  logger.info('Processing file retrievals', {
    userId: userComponent.id,
    storageKeys: pendingStorageKeys,
  })

  for (const storageKey of pendingStorageKeys) {
    try {
      logger.info('Retrieving file', { storageKey })

      // Get file from storage directly using storage key
      const fileResult = await deps.storage.retrieve(storageKey)
      if (!fileResult) {
        logger.warn('File data not found in storage', { storageKey })
        continue
      }

      const { data: fileData, mimeType: storedMimeType } = fileResult

      // Extract filename from storage key (simple approach)
      const filename = storageKey.split('/').pop() || 'unknown_file'

      // Use stored mime type, but fall back to extension-based detection
      let mimeType = storedMimeType

      if (!mimeType || mimeType === 'application/octet-stream') {
        const extension = filename.split('.').pop()?.toLowerCase()
        if (extension) {
          const mimeMap: Record<string, string> = {
            pdf: 'application/pdf',
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            txt: 'text/plain',
            md: 'text/markdown',
            doc: 'application/msword',
            docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xls: 'application/vnd.ms-excel',
            xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }
          mimeType = mimeMap[extension] || mimeType
        }
      }

      // Determine message type based on MIME type
      const isImage = mimeType.startsWith('image/')
      const messageType = isImage ? 'image' : 'document'

      // Create file message entity
      const fileEntity = frame.createEntity()
      frame.addComponent(fileEntity, 'Message', {
        role: 'assistant',
        type: messageType,
        priority: 1000, // High priority to send immediately
      })

      frame.addComponent(fileEntity, 'Media', {
        data: fileData,
        mimeType,
      })

      frame.addComponent(fileEntity, 'MediaMetadata', {
        filename,
      })

      logger.info('File entity created', {
        storageKey,
        filename,
        mimeType,
        type: messageType,
        dataSize: fileData.byteLength,
      })
    } catch (error) {
      logger.error('File retrieval failed', {
        storageKey,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
