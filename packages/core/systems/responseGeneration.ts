import type { Frame } from '../../agent/default/frame'
import { fetchMemoryTool } from '../../agent/default/tools/fetchMemory'
import { googlePlacesTool } from '../../agent/default/tools/googlePlaces'
import { searchFilesTool } from '../../agent/default/tools/searchFiles'
import { sendFileTool } from '../../agent/default/tools/sendFile'
import { sendReactionTool } from '../../agent/default/tools/sendReaction'
import { updateUserProfileTool } from '../../agent/default/tools/updateUserProfile'
import { webFetchTool } from '../../agent/default/tools/webFetch'
import { webSearchTool } from '../../agent/default/tools/webSearch'
import { recentMessages as recentMessagesPrompt } from '../../agent/zapid/prompts/recentMessages'
import { userProfile } from '../../agent/zapid/prompts/userProfile'
import type { AIMessage } from '../core-ai'
import { ResponseGenerationError } from '../errors'
import type { MessageType } from '../infra/db'
import { extractFilename } from '../utils/storageKey'

//const logger = getLogger(['app', 'agent', 'responseGeneration'])

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
    console.log('Context included: user profile')
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
    console.log(`Context: recent messages (${recentMessages.length})`)
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
        sendFileTool(frame, deps),
        webSearchTool(frame, deps),
        webFetchTool(frame, deps),
        googlePlacesTool(frame, deps),
        sendReactionTool(frame, deps),
        updateUserProfileTool(frame, deps),
      ],
    })

    for await (const chunk of response.stream) {
      const externalChatId = await deps.chat.sendText({ text: chunk })
      frame.outboundMessages.push({
        externalChatId,
        type: 'text',
        text: chunk,
      })
    }

    console.log(`Sent ${frame.outboundMessages.length} text message(s)`)
  } catch (error) {
    const errorText = 'Desculpe, tive algum problema ao tentar te responder.'
    const externalChatId = await deps.chat.sendText({ text: errorText })
    frame.outboundMessages.push({
      externalChatId,
      type: 'text',
      text: errorText,
    })
    throw error
  }
}
