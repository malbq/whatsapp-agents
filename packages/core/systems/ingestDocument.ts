import type { Frame } from '../../agent/default/frame'
import { IngestionError } from '../errors'
import { parsePdf } from '../utils/parsePdf'
import { spreadError } from '../utils/spreadError'

//const logger = getLogger(['app', 'agent', 'ingestion', 'document'])

export async function ingestDocument(frame: Frame, deps: Deps): Promise<void> {
  if (!frame.inbound?.media?.data)
    throw new IngestionError('Media is required for document ingestion')
  if (!frame.inbound?.media?.mimeType)
    throw new IngestionError('Media mime type is required for document ingestion')
  if (!frame.inbound?.media?.filename)
    throw new IngestionError('Filename is required for document ingestion')
  try {
    frame.inbound.media.transcription = await parseDocument(
      deps,
      frame.inbound.media.data,
      frame.inbound.media.mimeType,
      frame.inbound.media.filename
    )
    console.debug(
      `Processed document "${frame.inbound.media.filename}" of type ${frame.inbound.media.mimeType} (${frame.inbound.media.data.byteLength} bytes)`
    )
  } catch (error) {
    frame.outboundMessages.push({
      type: frame.inbound.type,
      text: 'Desculpe, tive um problema ao processar o documento.',
    })

    console.error('Document ingestion error', { ...spreadError(error) })
    throw new IngestionError('Failed to process document')
  }
}

async function parseDocument(
  deps: Deps,
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
  return await deps.ai.transcribeDocument({
    document,
    mimeType,
    filename,
  })
}
