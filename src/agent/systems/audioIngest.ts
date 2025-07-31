import { ComponentNotFoundError, IngestionError } from '../../errors'
import * as Prompt from '../../prompts/prompt'
import { ASSISTANT_PRIORITY, SYSTEM_PRIORITY } from '../../utils/priorities'
import type { EntityId, Frame } from '../frame'

export async function audioIngest(
  frame: Frame,
  deps: Deps,
  messageEntity: EntityId
): Promise<void> {
  const media = frame.getComponent(messageEntity, 'Media')
  if (!media) throw new ComponentNotFoundError(messageEntity, 'Media')
  try {
    const transcribed = await deps.ai.transcribeAudio({ audio: media.data })
    const systemMessageEntity = frame.createEntity()
    frame.addComponent(systemMessageEntity, 'Message', {
      role: 'system',
      type: 'audio',
      priority: SYSTEM_PRIORITY,
    })
    frame.addComponent(systemMessageEntity, 'TextContent', {
      text: Prompt.audioTranscription(transcribed),
    })
  } catch (error) {
    console.error('AudioIngest error:', error)
    const errorMessageEntity = frame.createEntity()
    frame.addComponent(errorMessageEntity, 'Message', {
      role: 'assistant',
      type: 'text',
      priority: ASSISTANT_PRIORITY,
    })
    frame.addComponent(errorMessageEntity, 'TextContent', {
      text: `Desculpe, tive um problema ao transcrever o áudio.`,
    })

    throw new IngestionError('Failed to transcribe audio')
  }
}
