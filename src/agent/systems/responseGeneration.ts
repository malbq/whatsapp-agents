import { getLogger } from '@logtape/logtape'
import { ResponseGenerationError } from '../../errors'
import type { AIMessage } from '../../infra/ai'
import { audioTranscription } from '../../prompts/audioTranscription'
import { documentTranscription } from '../../prompts/documentTranscription'
import { imageDescription } from '../../prompts/imageDescription'
import { recentMessages as recentMessagesPrompt } from '../../prompts/recentMessages'
import { userMemory } from '../../prompts/userMemory'
import { userProfile } from '../../prompts/userProfile'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'responseGeneration'])

export async function ResponseGeneration(frame: Frame, deps: Deps) {
  if (!frame.user) throw new ResponseGenerationError('User not found')
  if (!frame.inbound?.text && !frame.inbound?.media?.transcription)
    throw new ResponseGenerationError('User message not found')

  const recentMessages = await deps.db.findRecentMessages({ userId: frame.user.id })
  const similarMessages = frame.inbound.textEmbedding?.[0]
    ? await deps.db.findSimilarMessages({
        userId: frame.user.id,
        queryEmbedding: frame.inbound.textEmbedding[0].embedding,
        excludeIds: recentMessages.map((message) => message.id),
      })
    : []

  // BUILD CONTEXT
  const messagesForAgent: Array<AIMessage> = []

  // CONTEXT: USER PROFILE
  if (frame.user.profile.length) {
    messagesForAgent.push({ role: 'system', content: userProfile(frame.user.profile) })
    logger.info('Context included: user profile')
  }

  // CONTEXT: MEMORY (similar messages)
  if (similarMessages.length) {
    messagesForAgent.push({ role: 'system', content: userMemory(similarMessages) })
    logger.info(`Context included: similar messages (${similarMessages.length})`)
  }

  // CONTEXT: RECENT THREAD
  if (recentMessages.length) {
    messagesForAgent.push({ role: 'system', content: recentMessagesPrompt })
    recentMessages.forEach((message) => {
      messagesForAgent.push({ role: message.role, content: message.content })
    })
    logger.info(`Context: recent messages (${recentMessages.length})`)
  }

  // CLARIFICATION MESSAGES BASED ON INBOUND TYPE
  if (frame.inbound.type === 'audio') {
    messagesForAgent.push({ role: 'system', content: audioTranscription })
  }
  if (frame.inbound.type === 'image') {
    messagesForAgent.push({ role: 'system', content: imageDescription })
  }
  if (frame.inbound.type === 'document') {
    messagesForAgent.push({
      role: 'system',
      content: documentTranscription(frame.inbound.media?.filename),
    })
  }

  // USER MESSAGE CONTENT
  if (frame.inbound.media?.transcription) {
    messagesForAgent.push({ role: 'user', content: frame.inbound.media.transcription })
  }
  if (frame.inbound.text) {
    messagesForAgent.push({ role: 'user', content: frame.inbound.text })
  }

  try {
    const searchFilesCallback = async () => {
      if (!frame.inbound?.textEmbedding?.[0]?.embedding) return []
      const results = await deps.db.searchFiles({
        userId: frame.user!.id,
        queryEmbedding: frame.inbound.textEmbedding[0].embedding,
      })
      return results.map((file) => ({
        storageKey: file.storageKey,
        timestamp: file.timestamp,
        snippet: file.snippet,
        score: file.score,
      }))
    }
    const response = await deps.ai.respond({
      messages: messagesForAgent,
      searchFilesCallback,
    })
    logger.info(`Response generated for ${frame.user.name} (${frame.user.externalId})`)
    logger.debug(`Generated response: ${response.text}`, { ...response })

    frame.outbound = {
      type: 'text',
      text: response.text,
    }

    if (response.storageKey) {
      frame.outbound.media = { storageKey: response.storageKey }
    }
  } catch (error) {
    frame.outbound = {
      type: 'text',
      text: 'Desculpe, tive algum problema ao tentar te responder.',
    }
    throw error
  }
}
