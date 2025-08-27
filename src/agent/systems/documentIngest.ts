import { getLogger } from '@logtape/logtape'
import { IngestionError } from '../../errors'
import * as Prompt from '../../prompts/prompt'
import { parsePdf } from '../../utils/parsePdf'
import { spreadError } from '../../utils/spreadError'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'ingestion', 'document'])

export async function documentIngest(frame: Frame, deps: Deps): Promise<void> {
  if (!frame.inbound?.media?.data)
    throw new IngestionError('Media is required for document ingestion')

  if (!frame.inbound?.document?.filename)
    throw new IngestionError('Filename is required for document processing')

  try {
    const transcription = await parseDocument(
      deps,
      frame.inbound.media.data,
      frame.inbound.media.mimeType,
      frame.inbound.document.filename
    )
    frame.inbound.document.transcription = transcription
    frame.systemMessages.push({
      type: frame.inbound.type,
      text: Prompt.documentTranscription(transcription, frame.inbound.document.filename),
    })
  } catch (error) {
    frame.outbound = {
      type: frame.inbound.type,
      text: 'Desculpe, tive um problema ao processar o documento.',
    }

    logger.error('Document ingestion error', { ...spreadError(error) })
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
