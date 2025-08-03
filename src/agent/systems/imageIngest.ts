import { getLogger } from '@logtape/logtape'
import { ComponentNotFoundError, IngestionError } from '../../errors'
import * as Prompt from '../../prompts/prompt'
import { ASSISTANT_PRIORITY, SYSTEM_PRIORITY } from '../../utils/priorities'
import { spreadError } from '../../utils/spreadError'
import type { EntityId, Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'ingestion', 'image'])

export async function imageIngest(
  frame: Frame,
  deps: Deps,
  messageEntity: EntityId,
  caption?: string
): Promise<void> {
  const media = frame.getComponent(messageEntity, 'Media')
  if (!media) throw new ComponentNotFoundError(messageEntity, 'Media')

  try {
    const base64Image = Buffer.from(media.data).toString('base64')
    const description = await deps.ai.analyzeImage({
      imageUrl: `data:${media.mimeType};base64,${base64Image}`,
      caption,
    })

    const systemMessageEntity = frame.createEntity()
    frame.addComponent(systemMessageEntity, 'Message', {
      role: 'system',
      type: 'image',
      priority: SYSTEM_PRIORITY,
    })
    frame.addComponent(systemMessageEntity, 'TextContent', {
      text: Prompt.imageDescription(description),
    })
    if (caption) {
      frame.addComponent(messageEntity, 'TextContent', { text: caption })
    } else {
      const noCaptionMessageEntity = frame.createEntity()
      frame.addComponent(noCaptionMessageEntity, 'Message', {
        role: 'system',
        type: 'image',
        priority: SYSTEM_PRIORITY,
      })
      frame.addComponent(noCaptionMessageEntity, 'TextContent', {
        text: Prompt.imageWithoutCaption,
      })
    }
  } catch (error) {
    logger.error('Image ingestion error', { ...spreadError(error) })
    const errorMessageEntity = frame.createEntity()
    frame.addComponent(errorMessageEntity, 'Message', {
      role: 'assistant',
      type: 'text',
      priority: ASSISTANT_PRIORITY,
    })
    frame.addComponent(errorMessageEntity, 'TextContent', {
      text: `Desculpe, tive um problema ao analisar a imagem.`,
    })

    throw new IngestionError('Failed to analyze image')
  }
}
