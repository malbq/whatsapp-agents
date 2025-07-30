import { ComponentNotFoundError } from '../../errors'
import type { AIMessage } from '../../infra/ai'
import * as Prompt from '../../prompts/prompt'
import { ASSISTANT_PRIORITY } from '../../utils/priorities'
import type { EntityId, Frame } from '../frame'

export async function ResponseGenerationSystem(frame: Frame, deps: Deps, messageEntity: EntityId) {
  const userComponent = frame.getComponent(frame.USER_ENTITY_ID, 'User')
  if (!userComponent) throw new ComponentNotFoundError(frame.USER_ENTITY_ID, 'User')

  const recentMessages = await deps.db.findRecentMessages({ userId: userComponent.id })
  const vectorEmbedding = frame.getComponent(messageEntity, 'VectorEmbedding')
  const similarMessages = vectorEmbedding
    ? await deps.db.findSimilarMessages({
        userId: userComponent.id,
        // FIXME: find better strategy to search when input has multiple chunks
        // Whatsapp messages will probably always be less than 2000 characters
        // so they will never have multiple chunks
        queryEmbedding: vectorEmbedding.chunks[0]!.embedding,
        excludeIds: recentMessages.map((message) => message.id),
      })
    : []

  const messages: Array<AIMessage> = []

  if (userComponent.profile) {
    messages.push({ role: 'system', content: Prompt.userProfile(userComponent.profile) })
  }
  // TODO: current schedule
  if (similarMessages.length) {
    messages.push({ role: 'system', content: Prompt.userMemory(similarMessages) })
  }
  if (recentMessages.length) {
    messages.push({ role: 'system', content: Prompt.recentMessages })
    recentMessages.forEach((message) => {
      messages.push({ role: message.role, content: message.content })
    })
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
    const response = await deps.ai.respond({ instructions: Prompt.system, messages })

    const responseEntity = frame.createEntity()
    frame.addComponent(responseEntity, 'Message', {
      role: 'assistant',
      type: 'text',
      priority: ASSISTANT_PRIORITY,
    })
    frame.addComponent(responseEntity, 'TextContent', { text: response })
  } catch (error) {
    console.error('ResponseGenerationSystem error:', error)
    frame.addComponent(messageEntity, 'ErrorComponent', {
      message: 'Desculpe, tive algum problema ao gerar a resposta.',
    })
  }
}
