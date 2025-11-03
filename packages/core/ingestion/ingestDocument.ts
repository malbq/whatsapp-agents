import type { DocumentMessage } from '@batman/whatsapp'
import { transcribeDocument } from '../ai/transcribeDocument'
import { IngestionError } from '../errors'
import { parsePdf } from '../utils/parsePdf'
import { spreadError } from '../utils/spreadError'

export async function ingestDocument(message: DocumentMessage): Promise<string> {
  try {
    const transcription = await parseDocument(message.data, message.mimeType, message.filename)
    console.debug(
      `Processed document "${message.filename}" of type ${message.mimeType} (${message.data.byteLength} bytes)`
    )
    let content = `Document transcription: ${transcription}\n\nFile name: ${message.filename}`
    if (message.caption) {
      content = `${content}\n\nCaption: ${message.caption}`
    }
    return content
  } catch (error) {
    console.error('Document ingestion error', { ...spreadError(error) })
    throw new IngestionError('Failed to process document')
  }
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
