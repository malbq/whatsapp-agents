import { getLogger } from '@logtape/logtape'
import { ResponseGenerationError } from '../../errors'
import type { AIMessage } from '../../infra/ai'
import * as Prompt from '../../prompts/prompt'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'responseGeneration'])

export async function ResponseGeneration(frame: Frame, deps: Deps) {
  if (!frame.user) throw new ResponseGenerationError('User not found')
  if (!frame.inbound) throw new ResponseGenerationError('Inbound message not found')

  const recentMessages = await deps.db.findRecentMessages({ userId: frame.user.id })
  const similarMessages = frame.inbound.embeddedContent?.[0]
    ? await deps.db.findSimilarMessages({
        userId: frame.user.id,
        // FIXME: find better strategy to search when input has multiple chunks
        // Whatsapp messages will probably always be less than 2000 characters
        // so they will hardly have multiple chunks
        queryEmbedding: frame.inbound.embeddedContent[0].embedding,
        excludeIds: recentMessages.map((message) => message.id),
      })
    : []

  const messagesForAgent: Array<AIMessage> = []

  if (frame.user.profile.length) {
    messagesForAgent.push({ role: 'system', content: Prompt.userProfile(frame.user.profile) })
    logger.info('Context included: user profile')
  }
  // TODO: current schedule
  if (similarMessages.length) {
    messagesForAgent.push({ role: 'system', content: Prompt.userMemory(similarMessages) })
    logger.info('Context included: similar messages')
  }
  if (recentMessages.length) {
    messagesForAgent.push({ role: 'system', content: Prompt.recentMessages })
    recentMessages.forEach((message) => {
      messagesForAgent.push({ role: message.role, content: message.content })
    })
    logger.info('Context: recent messages')
  }

  frame.systemMessages.forEach(({ text }) => {
    if (!text) return

    messagesForAgent.push({
      role: 'system',
      content: text,
    })
  })

  if (frame.inbound.text) {
    messagesForAgent.push({
      role: 'user',
      content: frame.inbound.text,
    })
  }

  try {
    const response = await deps.ai.respond({
      messages: messagesForAgent,
      userMessageEmbedding: frame.inbound.embeddedContent?.[0]?.embedding,
    })

    // Create response text entity
    frame.outbound = {
      type: frame.inbound.type,
      text: response.text,
    }

    if (response.storageKey) {
      frame.outbound.retrieval = { storageKey: response.storageKey }
    }
  } catch (error) {
    frame.outbound = {
      type: frame.inbound.type,
      text: `Desculpe, tive algum problema ao tentar te responder.`,
    }
    throw error
  }
}
