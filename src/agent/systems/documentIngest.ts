import { ComponentNotFoundError } from '../../errors'
import * as Prompt from '../../prompts/prompt'
import { parsePdf } from '../../utils/parsePdf'
import { SYSTEM_PRIORITY } from '../../utils/priorities'
import type { EntityId, Frame } from '../frame'

export async function documentIngest(
  frame: Frame,
  deps: Deps,
  messageEntity: EntityId,
  filename: string
): Promise<void> {
  const media = frame.getComponent(messageEntity, 'Media')
  if (!media) throw new ComponentNotFoundError(messageEntity, 'Media')
  try {
    const description = await parseDocument(deps, media.data, media.mimeType, filename)
    const systemMessageEntity = frame.createEntity()
    frame.addComponent(systemMessageEntity, 'Message', {
      role: 'system',
      type: 'document',
      priority: SYSTEM_PRIORITY,
    })
    frame.addComponent(systemMessageEntity, 'TextContent', {
      text: Prompt.documentDescription(description, filename),
    })
  } catch {
    frame.addComponent(messageEntity, 'ErrorComponent', {
      message: 'Desculpe, tive um problema ao processar o documento.',
    })
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
