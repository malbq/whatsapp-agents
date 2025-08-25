import { getLogger } from '@logtape/logtape'
import type { AIMessage } from '../../infra/ai'
import * as Prompt from '../../prompts/prompt'
import { ASSISTANT_PRIORITY } from '../../utils/priorities'
import { spreadError } from '../../utils/spreadError'
import type { EntityId, Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'responseGeneration'])

export async function ResponseGenerationSystem(frame: Frame, deps: Deps, messageEntity: EntityId) {
  const userComponent = frame.getRequiredComponent(frame.USER_ENTITY_ID, 'User')

  const recentMessages = await deps.db.findRecentMessages({ userId: userComponent.id })
  const vectorEmbedding = frame.getComponent(messageEntity, 'VectorEmbedding')
  const similarMessages = vectorEmbedding
    ? await deps.db.findSimilarMessages({
        userId: userComponent.id,
        // FIXME: find better strategy to search when input has multiple chunks
        // Whatsapp messages will probably always be less than 2000 characters
        // so they will hardly have multiple chunks
        queryEmbedding: vectorEmbedding.chunks[0]!.embedding,
        excludeIds: recentMessages.map((message) => message.id),
      })
    : []

  const messages: Array<AIMessage> = []

  if (userComponent.profile) {
    messages.push({ role: 'system', content: Prompt.userProfile(userComponent.profile) })
    logger.info('context: user profile')
  }
  // TODO: current schedule
  if (similarMessages.length) {
    messages.push({ role: 'system', content: Prompt.userMemory(similarMessages) })
    logger.info('context: similar messages')
  }
  if (recentMessages.length) {
    messages.push({ role: 'system', content: Prompt.recentMessages })
    recentMessages.forEach((message) => {
      messages.push({ role: message.role, content: message.content })
    })
    logger.info('context: recent messages')
  }

  frame
    .query(['Message', 'TextContent'])
    .map((entityId) => ({
      message: frame.getComponent(entityId, 'Message')!,
      textContent: frame.getComponent(entityId, 'TextContent')!,
    }))
    .sort((a, b) => a.message.priority - b.message.priority)
    .forEach(({ message, textContent }) => {
      messages.push({
        role: message.role,
        content: textContent.text,
      })
    })

  try {
    const response = await deps.ai.respond({
      messages,
      userMessageEmbedding: vectorEmbedding?.chunks[0]?.embedding,
    })

    // Create response text entity
    const responseEntity = frame.createEntity()
    frame.addComponent(responseEntity, 'Message', {
      role: 'assistant',
      type: 'text',
      priority: ASSISTANT_PRIORITY,
    })
    frame.addComponent(responseEntity, 'TextContent', { text: response.text })
    // if (response.storageKey) {
    //   frame.addComponent(responseEntity, '', { key: response.storageKey })
    // }
  } catch (error) {
    logger.error('Response generation error', { ...spreadError(error) })
    const errorMessageEntity = frame.createEntity()
    frame.addComponent(errorMessageEntity, 'Message', {
      role: 'assistant',
      type: 'text',
      priority: ASSISTANT_PRIORITY,
    })
    frame.addComponent(errorMessageEntity, 'TextContent', {
      text: `Desculpe, tive algum problema ao tentar te responder.`,
    })
  }
}
