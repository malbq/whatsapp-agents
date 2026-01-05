import { openai } from '@ai-sdk/openai'
import { generateWhatsappMessage } from '@batman/core/ai/generateWhatsappMessage'
import { ResponseGenerationError } from '@batman/core/errors'
import type { DB } from '@batman/core/infra/db'
import {
  createSearchConversationHistoryTool,
  createSearchFilesTool,
  createSendReactionTool,
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
import { system } from '../prompts/system'
import { userProfile } from '../prompts/userProfile'
import { googlePlacesTool } from '../tools/googlePlaces'
import { updateUserProfileTool } from '../tools/updateUserProfile'
import { hasQuotaRemaining, isFeatureEnabled, recordUsage } from './entitlements'

ok(import.meta.env.OPENAI_API_KEY, 'OPENAI_API_KEY is required')
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
    toSystemModelMessage(`Current date: ${new Date().toDateString()}.`),
  ]

  if (user.profile.length > 0) {
    agentContext.push(userProfile(user.profile))
    console.debug('Context included: user profile')
  }

  const recentMessageIds = recentMessages.map((m) => m.id)

  // Flatten messages array from each row and fill media data
  await fillMediaMessagesWithData(recentMessages)
  for (const row of recentMessages) {
    agentContext.push(...row.messages)
  }

  console.debug(`Generating WhatsApp message`, {
    provider: model.provider,
    model: model.modelId,
    context: agentContext,
  })
  const response = await generateWhatsappMessage({
    model,
    system,
    messages: agentContext,
    abortSignal: context.abortSignal,
    tools: createToolSet({
      userId: user.id,
      recentMessageIds,
      lastUserMessageWaId: lastUserMessage.waId,
    }),
    stopWhen: stepCountIs(MAX_STEPS),
    providerOptions: {
      openai: {
        textVerbosity: 'low',
        reasoningSummary: null,
        parallelToolCalls: false,
        strictJsonSchema: false,
      },
    },
  })
  console.debug('Generated WhatsApp message', {
    provider: model.provider,
    model: model.modelId,
    response,
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

  // Map row index to storage key (only user messages can have resources)
  const messagesToFill = new Map(
    recentMessages
      .map<[number, string | undefined | null]>((row, index) => [index, row.storageKey])
      .filter(([_, storageKey]) => !!storageKey) as Array<[number, string]>
  )
  const data = new Map<DB.Resource['storageKey'], ArrayBuffer>()
  const keys = new Set<DB.Resource['storageKey']>(messagesToFill.values())

  await Promise.all(
    keys.values().map(async (storageKey) => {
      const fileData = await context.storage.retrieve(storageKey)
      console.debug(
        `[fillMediaMessagesWithData] Retrieved ${storageKey} - ${fileData.data.byteLength} bytes`
      )
      if (fileData.data.byteLength === 0) {
        console.warn(`[fillMediaMessagesWithData] Empty data for storage key ${storageKey}`)
      }
      data.set(storageKey, fileData.data)
    })
  )

  // Fill media data in messages array (user messages have single element)
  for (const [index, storageKey] of messagesToFill.entries()) {
    const row = recentMessages[index]!
    // User messages have a single element in the messages array
    const modelMessage = row.messages[0]
    if (modelMessage && Array.isArray(modelMessage.content)) {
      for (const part of modelMessage.content) {
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

  const webSearchTool = createWebSearchTool({
    webSearch,
    afterExecution() {
      recordUsage('n_web_search_calls_per_day', 1)
    },
  })

  const sendReactionTool = createSendReactionTool({
    sendReaction: async (emoji) => {
      if (!lastUserMessageWaId) return
      return chat.sendReaction(user.waId, { emoji, targetMessageId: lastUserMessageWaId })
    },
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

  const toolset: ToolSet = {
    [sendReactionTool.title!]: sendReactionTool,
  }
  if (isFeatureEnabled('b_enable_memory_tool')) {
    toolset[searchConversationHistoryTool.title!] = searchConversationHistoryTool
  }
  if (isFeatureEnabled('b_enable_file_retrieval')) {
    toolset[searchFilesTool.title!] = searchFilesTool
  }
  if (isFeatureEnabled('b_enable_profile_tool')) {
    toolset[updateUserProfileTool.title!] = updateUserProfileTool
  }
  if (
    isFeatureEnabled('b_enable_web_search_tool') &&
    hasQuotaRemaining('n_web_search_calls_per_day')
  ) {
    toolset[webSearchTool.title!] = webSearchTool
  }
  if (isFeatureEnabled('b_enable_web_fetch_tool')) {
    toolset[webFetchTool.title!] = webFetchTool
  }
  if (
    isFeatureEnabled('b_enable_google_places_tool') &&
    hasQuotaRemaining('n_google_places_calls_per_day')
  ) {
    toolset[googlePlacesTool.title!] = googlePlacesTool
  }

  return toolset
}
