import { getLogger } from '@logtape/logtape'
import { IngestionError } from '../../errors'
import * as Prompt from '../../prompts/prompt'
import { spreadError } from '../../utils/spreadError'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'ingestion', 'image'])

export async function imageIngest(frame: Frame, deps: Deps): Promise<void> {
  if (!frame.inbound?.media) throw new IngestionError('Media is required for image ingestion')

  try {
    const base64Image = Buffer.from(frame.inbound.media.data).toString('base64')
    const description = await deps.ai.analyzeImage({
      imageUrl: `data:${frame.inbound.media.mimeType};base64,${base64Image}`,
      caption: frame.inbound.text,
    })
    frame.inbound.image = { description }

    frame.systemMessages.push({
      type: frame.inbound.type,
      text: Prompt.imageDescription(description),
    })

    if (!frame.inbound.text) {
      frame.systemMessages.push({
        type: frame.inbound.type,
        text: Prompt.imageWithoutCaption,
      })
    }
  } catch (error) {
    frame.outbound = {
      type: frame.inbound.type,
      text: 'Desculpe, tive um problema ao analisar a imagem.',
    }

    logger.error('Image ingestion error', { ...spreadError(error) })
    throw new IngestionError('Failed to analyze image')
  }
}
