import { transcribeDocument } from '@batman/core/ai/transcribeDocument'
import { parsePdf } from '@batman/core/utils/parsePdf'
import type { Frame } from '../frame'
import type { Deps } from '../types'

export async function ingestDocument(frame: Frame, deps: Deps): Promise<void> {
  // if (!frame.inbound?.media?.data)
  //   throw new IngestionError('Media is required for document ingestion')
  // if (!frame.inbound?.media?.mimeType)
  //   throw new IngestionError('Media mime type is required for document ingestion')
  // if (!frame.inbound?.media?.filename)
  //   throw new IngestionError('Filename is required for document ingestion')
  // try {
  //   frame.inbound.media.transcription = await parseDocument(
  //     deps,
  //     frame.inbound.media.data,
  //     frame.inbound.media.mimeType,
  //     frame.inbound.media.filename
  //   )
  //   console.debug(
  //     `Processed document "${frame.inbound.media.filename}" of type ${frame.inbound.media.mimeType} (${frame.inbound.media.data.byteLength} bytes)`
  //   )
  // } catch (error) {
  //   frame.outboundMessages.push({
  //     type: frame.inbound.type,
  //     text: 'Desculpe, tive um problema ao processar o documento.',
  //   })
  //   console.error('Document ingestion error', { ...spreadError(error) })
  //   throw new IngestionError('Failed to process document')
  // }
}

async function parseDocument(
  document: ArrayBuffer,
  mimeType: string,
  filename: string
): Promise<string> {
  if (mimeType === 'application/pdf') {
    const text = await parsePdf(document)
    if (text.trim().length > 0) {
      return text
    }
  }
  return await transcribeDocument({
    document,
    mimeType,
    filename,
  })
}
