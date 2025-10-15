import { getLogger } from '@logtape/logtape'
import { ResponseGenerationError } from '../../errors'
import type { AIMessage } from '../../infra/ai'
import type { MessageType } from '../../infra/db'
import { extractFilename } from '../../utils/storageKey'
import type { Frame } from '../frame'
import { recentMessages as recentMessagesPrompt } from '../prompts/recentMessages'
import { userProfile } from '../prompts/userProfile'
import { fetchMemoryTool } from '../tools/fetchMemory'
import { googlePlacesTool } from '../tools/googlePlaces'
import { searchFilesTool } from '../tools/searchFiles'
import { sendFileTool } from '../tools/sendFile'
import { sendReactionTool } from '../tools/sendReaction'
import { updateUserProfileTool } from '../tools/updateUserProfile'
import { webFetchTool } from '../tools/webFetch'
import { webSearchTool } from '../tools/webSearch'

const logger = getLogger(['app', 'agent', 'responseGeneration'])

function formatWithTag(type: MessageType, content: string, filename?: string) {
  switch (type) {
    case 'audio':
      return `[aud] ${content}`
    case 'image':
      return `[img] ${content}`
    case 'document':
      return `[doc${filename ? `:${filename}` : ''}] ${content}`
    default:
      return content
  }
}

export async function responseGeneration(frame: Frame, deps: Deps) {
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
      messagesForAgent.push({
        role: message.role,
        content: formatWithTag(message.type, message.content, extractFilename(message.storageKey)),
      })
    })
    logger.info(`Context: recent messages (${recentMessages.length})`)
  }

  // USER MESSAGE CONTENT
  if (frame.inbound.media?.transcription) {
    messagesForAgent.push({
      role: 'user',
      content: formatWithTag(
        frame.inbound.type,
        frame.inbound.media?.transcription,
        frame.inbound.media?.filename
      ),
    })
  }
  if (frame.inbound.text) {
    messagesForAgent.push({ role: 'user', content: frame.inbound.text })
  }

  try {
    const response = await deps.ai.respond({
      messages: messagesForAgent,
      tools: [
        fetchMemoryTool(frame, deps, recentMessages),
        searchFilesTool(frame, deps),
        webSearchTool(frame, deps),
        webFetchTool(frame, deps),
        googlePlacesTool(frame, deps),
        sendFileTool(frame, deps),
        sendReactionTool(frame, deps),
        updateUserProfileTool(frame, deps),
      ],
    })

    const externalChatId = await deps.chat.sendText({ text: response.text })

    logger.info(`Sent 'text' response`)

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
