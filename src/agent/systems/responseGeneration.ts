import { getLogger } from '@logtape/logtape'
import { ResponseGenerationError } from '../../errors'
import type { AIMessage } from '../../infra/ai'
import type { MessageType } from '../../infra/db'
import * as Prompt from '../../prompts/prompt'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'responseGeneration'])

function mapMimeTypeToMessageType(mime: string | undefined): MessageType | null {
  if (!mime) return null
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'document'
  return null
}

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
    messagesForAgent.push({ role: 'system', content: Prompt.userProfile(frame.user.profile) })
    logger.info('Context included: user profile')
  }

  // CONTEXT: MEMORY (similar messages)
  if (similarMessages.length) {
    messagesForAgent.push({ role: 'system', content: Prompt.userMemory(similarMessages) })
    logger.info(`Context included: similar messages (${similarMessages.length})`)
  }

  // CONTEXT: RECENT THREAD
  if (recentMessages.length) {
    messagesForAgent.push({ role: 'system', content: Prompt.recentMessages })
    recentMessages.forEach((message) => {
      messagesForAgent.push({ role: message.role, content: message.content })
    })
    logger.info(`Context: recent messages (${recentMessages.length})`)
  }

  // CLARIFICATION MESSAGES BASED ON INBOUND TYPE
  if (frame.inbound.type === 'audio') {
    messagesForAgent.push({ role: 'system', content: Prompt.audioTranscription })
  }
  if (frame.inbound.type === 'image') {
    messagesForAgent.push({ role: 'system', content: Prompt.imageDescription })
  }
  if (frame.inbound.type === 'document') {
    messagesForAgent.push({
      role: 'system',
      content: Prompt.documentTranscription(frame.inbound.media?.filename),
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
    const userMessageEmbedding = frame.inbound.textEmbedding?.[0]?.embedding
    const response = await deps.ai.respond({
      messages: messagesForAgent,
      userMessageEmbedding,
    })
    logger.info(`Response generated: ${response.text}`, { ...response })

    if (response.storageKey) {
      const media = await deps.storage.retrieve(response.storageKey)
      const outboundType = mapMimeTypeToMessageType(media?.mimeType)
      if (!outboundType) {
        throw new ResponseGenerationError(
          `Media with ${media?.mimeType} mime type cannot be sent in response`
        )
      }
      frame.outbound = {
        type: outboundType,
        text: response.text,
        media: {
          data: media.data,
          mimeType: media.mimeType,
          filename: media.filename,
        },
      }
      return
    }

    frame.outbound = {
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
