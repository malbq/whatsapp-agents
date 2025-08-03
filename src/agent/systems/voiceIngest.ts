import { getLogger } from '@logtape/logtape'
import { ComponentNotFoundError, IngestionError } from '../../errors'
import { ASSISTANT_PRIORITY } from '../../utils/priorities'
import { spreadError } from '../../utils/spreadError'
import type { EntityId, Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'ingestion', 'voice'])

export async function voiceIngest(
  frame: Frame,
  deps: Deps,
  messageEntity: EntityId
): Promise<void> {
  const media = frame.getComponent(messageEntity, 'Media')
  if (!media) throw new ComponentNotFoundError(messageEntity, 'Media')
  try {
    const transcribed = await deps.ai.transcribeAudio({ audio: media.data })
    frame.addComponent(messageEntity, 'TextContent', { text: transcribed })
  } catch (error) {
    logger.error('Voice ingestion error', { ...spreadError(error) })
    const errorMessageEntity = frame.createEntity()
    frame.addComponent(errorMessageEntity, 'Message', {
      role: 'assistant',
      type: 'text',
      priority: ASSISTANT_PRIORITY,
    })
    frame.addComponent(errorMessageEntity, 'TextContent', {
      text: `Desculpe, tive um problema ao transcrever a mensagem de voz.`,
    })

    throw new IngestionError('Failed to transcribe voice message')
  }
}
