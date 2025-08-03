import { getLogger } from '@logtape/logtape'
import { ComponentNotFoundError, IngestionError } from '../../errors'
import type { IncomingMessage } from '../../infra/chat'
import type { ChunkData } from '../../infra/db'
import { splitIntoChunks } from '../../utils/splitIntoChunks'
import type { EntityId, Frame } from '../frame'
import { audioIngest } from './audioIngest'
import { documentIngest } from './documentIngest'
import { imageIngest } from './imageIngest'
import { textIngest } from './textIngest'
import { voiceIngest } from './voiceIngest'

const logger = getLogger(['app', 'agent', 'ingestion'])

export async function IngestionSystem(
  frame: Frame,
  deps: Deps,
  messageEntity: EntityId,
  { text, documentFilename }: IncomingMessage
): Promise<EntityId> {
  const message = frame.getComponent(messageEntity, 'Message')
  if (!message) throw new ComponentNotFoundError(messageEntity, 'Message')

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
      logger.error(`Unsupported message type ${message.type}`)
      throw new IngestionError('Desculpe, ainda não consigo entender este tipo de mensagem.')
  }

  const textContent = frame.getComponent(messageEntity, 'TextContent')
  if (textContent) {
    const chunks = await splitIntoChunks(textContent.text)
    const embeddings = await deps.ai.generateEmbeddings({ text: chunks })
    logger.info`Input embeddings generated for ${chunks.length} chunks`
    const chunkData = chunks.map<ChunkData>((content, i) => ({
      content,
      embedding: embeddings[i]!,
    }))
    frame.addComponent(messageEntity, 'VectorEmbedding', { chunks: chunkData })
  }

  return messageEntity
}
