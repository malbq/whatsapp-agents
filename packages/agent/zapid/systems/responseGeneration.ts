import { openai } from '@ai-sdk/openai'
import { generateWhatsappMessage } from '@batman/core/ai/generateWhatsappMessage'
import { ResponseGenerationError } from '@batman/core/errors'
import type { DB } from '@batman/core/infra/db'
import {
  createSearchConversationHistoryTool,
  createSearchFilesTool,
  createSendReactionTool,
  createSendTextTool,
  createWebSearchTool,
  webFetchTool,
} from '@batman/core/tools'
import { sendWhatsappMessage } from '@batman/core/utils/sendWhatsappMessage'
import { toDbMessage } from '@batman/core/utils/toDbMessage'
import { toSystemModelMessage } from '@batman/core/utils/toModelMessage'
import { stepCountIs, type ModelMessage, type ToolSet } from 'ai'
import { ok } from 'node:assert'
import { getContext } from '../context'
import type { ZapidRepository } from '../db'
import { recentMessages as recentMessagesPrompt } from '../prompts/recentMessages'
import { system } from '../prompts/system'
import { userProfile } from '../prompts/userProfile'
import { googlePlacesTool } from '../tools/googlePlaces'
import { updateUserProfileTool } from '../tools/updateUserProfile'

const model = openai.responses('gpt-5-mini-2025-08-07')
const MAX_STEPS = 10

export async function responseGeneration() {
  const context = getContext()
  const user = context.user

  ok(user, new ResponseGenerationError('User not found'))

  const recentMessages = await context.db.findRecentMessages({ userId: user.id })

  if (recentMessages.length === 0) {
    throw new ResponseGenerationError('No messages found for user')
  }

  // Get last user message for typing indicator, reaction tool
  const lastUserMessage = recentMessages.findLast((m) => m.role === 'user')
  ok(lastUserMessage, new ResponseGenerationError('No user message found in recent messages'))

  if (lastUserMessage.waId) {
    context.chat.sendTypingIndicator(lastUserMessage.waId)
  }

  // Build agent context
  const agentContext: Array<ModelMessage> = [
    toSystemModelMessage(`Current date and time: ${new Date().toISOString()}.`),
  ]

  if (user.profile.length > 0) {
    agentContext.push(userProfile(user.profile))
    console.debug('Context included: user profile')
  }

  const recentMessageIds = recentMessages.map((m) => m.id)

  await fillMediaMessagesWithData(recentMessages)
  agentContext.push(
    toSystemModelMessage(recentMessagesPrompt),
    ...recentMessages.map((message) => message.modelMessage)
  )

  const response = await generateWhatsappMessage({
    model,
    system,
    messages: agentContext,
    tools: createToolSet({
      userId: user.id,
      recentMessageIds,
      lastUserMessageWaId: lastUserMessage.waId,
    }),
    stopWhen: stepCountIs(MAX_STEPS),
    providerOptions: {
      openai: {
        serviceTier: 'flex',
        textVerbosity: 'low',
        reasoningSummary: null,
      },
    },
  })

  const assistantMessageId = await sendWhatsappMessage({
    chat: context.chat,
    db: context.db,
    storage: context.storage,
    userId: user.id,
    userWaId: user.waId,
    message: response.output,
  })

  context.responseOutput = response.output
  context.outbound = toDbMessage({
    userId: user.id,
    assistantWaMessageId: assistantMessageId,
    response,
  })
}

// TODO in production, we should fill with signed URLs instead of raw data
async function fillMediaMessagesWithData(
  recentMessages: Awaited<ReturnType<ZapidRepository['findRecentMessages']>>
) {
  const context = getContext()
  console.log('fillMediaMessagesWithData: Processing', recentMessages.length, 'messages')

  const messagesToFill = new Map(
    recentMessages
      .map<[number, string | undefined | null]>((message, index) => [index, message.storageKey])
      .filter(([_, storageKey]) => !!storageKey) as Array<[number, string]>
  )
  const data = new Map<DB.Resource['storageKey'], ArrayBuffer>()
  const keys = new Set<DB.Resource['storageKey']>(messagesToFill.values())

  await Promise.all(
    keys.values().map(async (storageKey) => {
      const fileData = await context.storage.retrieve(storageKey)
      console.log(
        `fillMediaMessagesWithData: Retrieved ${storageKey} - ${fileData.data.byteLength} bytes`
      )
      if (fileData.data.byteLength === 0) {
        console.error(
          `fillMediaMessagesWithData: WARNING - Empty data for storage key ${storageKey}`
        )
      }
      data.set(storageKey, fileData.data)
    })
  )

  for (const [index, storageKey] of messagesToFill.entries()) {
    const message = recentMessages[index]!
    if (Array.isArray(message.modelMessage.content)) {
      for (const part of message.modelMessage.content) {
        if ('image' in part) {
          part.image = data.get(storageKey)!
        }
        if ('data' in part) {
          part.data = data.get(storageKey)!
        }
      }
    }
  }
}

interface CreateToolSetParams {
  userId: string
  recentMessageIds: Array<string>
  lastUserMessageWaId: string | null
}

function createToolSet({ userId, recentMessageIds, lastUserMessageWaId }: CreateToolSetParams) {
  const { user, chat, db, webSearch } = getContext()
  ok(user, 'User not found')

  const webSearchTool = createWebSearchTool({ webSearch })

  const sendReactionTool = createSendReactionTool({
    sendReaction: async (emoji) => {
      if (!lastUserMessageWaId) return
      return chat.sendReaction(user.waId, { emoji, targetMessageId: lastUserMessageWaId })
    },
  })

  const sendTextTool = createSendTextTool({
    userWhatsappId: user.waId,
    sendText: (text) => chat.sendText(user.waId, { text }),
  })

  const searchConversationHistoryTool = createSearchConversationHistoryTool({
    userId,
    recentMessageIds,
    searchSnippets: db.searchSnippets,
  })

  const searchFilesTool = createSearchFilesTool({
    userId,
    searchResources: db.searchResources,
  })

  return {
    [updateUserProfileTool.title!]: updateUserProfileTool,
    [sendReactionTool.title!]: sendReactionTool,
    [sendTextTool.title!]: sendTextTool,
    [searchConversationHistoryTool.title!]: searchConversationHistoryTool,
    [searchFilesTool.title!]: searchFilesTool,
    [webSearchTool.title!]: webSearchTool,
    [webFetchTool.title!]: webFetchTool,
    [googlePlacesTool.title!]: googlePlacesTool,
  } satisfies ToolSet
}
