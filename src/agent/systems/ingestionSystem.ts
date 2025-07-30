import { ComponentNotFoundError } from '../../errors'
import type { IncomingMessage } from '../../infra/chat'
import type { ChunkData } from '../../infra/db'
import { ASSISTANT_PRIORITY } from '../../utils/priorities'
import { splitIntoChunks } from '../../utils/splitIntoChunks'
import type { EntityId, Frame } from '../frame'
import { audioIngest } from './audioIngest'
import { documentIngest } from './documentIngest'
import { imageIngest } from './imageIngest'
import { textIngest } from './textIngest'
import { voiceIngest } from './voiceIngest'

export async function IngestionSystem(
  frame: Frame,
  deps: Deps,
  messageEntity: EntityId,
  { text, documentFilename }: IncomingMessage
): Promise<EntityId> {
  const message = frame.getComponent(messageEntity, 'Message')
  if (!message) throw new ComponentNotFoundError(messageEntity, 'Message')

  try {
    switch (message.type) {
      case 'image':
        await imageIngest(frame, deps, messageEntity, text)
        break
      case 'voice':
        await voiceIngest(frame, deps, messageEntity)
        break

      case 'audio':
        await audioIngest(frame, deps, messageEntity)
        break

      case 'document':
        if (!documentFilename) throw new Error('Document filename is required')
        await documentIngest(frame, deps, messageEntity, documentFilename)
        break
      case 'text':
        if (!text) throw new Error('Text content is required')
        await textIngest(frame, messageEntity, text)
        break

      default:
        const unsupportedMessageEntity = frame.createEntity()
        frame.addComponent(unsupportedMessageEntity, 'Message', {
          role: 'assistant',
          type: 'text',
          priority: ASSISTANT_PRIORITY,
        })
        frame.addComponent(unsupportedMessageEntity, 'TextContent', {
          text: `Desculpe, ainda não consigo entender este tipo de mensagem.`,
        })
        break
    }

    const textContent = frame.getComponent(messageEntity, 'TextContent')
    if (textContent) {
      const chunks = await splitIntoChunks(textContent.text)
      const embeddings = await deps.ai.generateEmbeddings({ text: chunks })
      const chunkData = chunks.map<ChunkData>((content, i) => ({
        content,
        embedding: embeddings[i]!,
      }))
      frame.addComponent(messageEntity, 'VectorEmbedding', { chunks: chunkData })
    }
  } catch (error) {
    console.error('IngestionSystem error:', error)
    frame.addComponent(messageEntity, 'ErrorComponent', {
      message: 'Desculpe, tive algum problema ao processar sua mensagem.',
    })
  }

  return messageEntity
}
