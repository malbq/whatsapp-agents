import { getLogger } from '@logtape/logtape'
import { ResponseGenerationError } from '../../errors'
import type { AIMessage } from '../../infra/ai'
import type { Frame } from '../frame'
import { audioTranscription } from '../prompts/audioTranscription'
import { documentTranscription } from '../prompts/documentTranscription'
import { imageDescription } from '../prompts/imageDescription'
import { recentMessages as recentMessagesPrompt } from '../prompts/recentMessages'
import { userProfile } from '../prompts/userProfile'

const logger = getLogger(['app', 'agent', 'responseGeneration'])

export async function ResponseGeneration(frame: Frame, deps: Deps) {
  if (!frame.user) throw new ResponseGenerationError('User not found')
  if (!frame.inbound?.text && !frame.inbound?.media?.transcription)
    throw new ResponseGenerationError('User message not found')

  // BUILD CONTEXT
  const messagesForAgent: Array<AIMessage> = []

  // CONTEXT: USER PROFILE
  if (frame.user.profile.length) {
    messagesForAgent.push({ role: 'system', content: userProfile(frame.user.profile) })
    logger.info('Context included: user profile')
  }

  // CONTEXT: RECENT THREAD
  const recentMessages = await deps.db.findRecentMessages({ userId: frame.user.id })
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
    const response = await deps.ai.respond({ messages: messagesForAgent })
    const externalChatId = await deps.chat.sendText({ text: response.text })

    logger.info(`Text response sent to ${frame.user.name} (${frame.user.externalId})`)

    frame.outbound = {
      externalChatId,
      type: 'text',
      text: response.text,
    }
  } catch (error) {
    frame.outbound = {
      type: 'text',
      text: 'Desculpe, tive algum problema ao tentar te responder.',
    }
    throw error
  }
}
