import { openai } from '@ai-sdk/openai'
import { generateWhatsappMessage } from '@batman/core/ai/generateWhatsappMessage'
import { ResponseGenerationError } from '@batman/core/errors'
import type { DB } from '@batman/core/infra/db'
import type { Storage } from '@batman/core/infra/storage'
import {
  createSendReactionTool,
  createSendTextTool,
  createWebSearchTool,
  webFetchTool,
} from '@batman/core/tools'
import { sendWhatsappMessage } from '@batman/core/utils/sendWhatsappMessage'
import { toDbMessage } from '@batman/core/utils/toDbMessage'
import { toSystemModelMessage } from '@batman/core/utils/toModelMessage'
import type { ModelMessage, ToolSet } from 'ai'
import { ok } from 'node:assert'
import { getContext } from '../context'
import type { ZapidRepository } from '../db'
import { recentMessages as recentMessagesPrompt } from '../prompts/recentMessages'
import { system } from '../prompts/system'
import { userProfile } from '../prompts/userProfile'
import { googlePlacesTool } from '../tools/googlePlaces'
import { updateUserProfileTool } from '../tools/updateUserProfile'

const model = openai.responses('gpt-5-mini-2025-08-07')

export async function responseGeneration() {
  const context = getContext()
  const user = context.user
  const inbound = context.inbound

  ok(user, new ResponseGenerationError('User not found'))
  ok(inbound, new ResponseGenerationError('Inbound message not found'))

  const agentContext: Array<ModelMessage> = []

  if (user.profile.length > 0) {
    agentContext.push(userProfile(user.profile))
    console.log('Context included: user profile')
  }

  await context.db.findRecentMessages({ userId: user.id }).then(async (recentMessages) => {
    if (recentMessages.length === 0) return
    await fillMediaMessagesWithData(recentMessages, context.storage)
    agentContext.push(
      toSystemModelMessage(recentMessagesPrompt),
      ...recentMessages.map((message) => message.modelMessage)
    )
  })

  agentContext.push(inbound.modelMessage)

  const response = await generateWhatsappMessage({
    model,
    system,
    messages: agentContext,
    tools: createToolSet(),
    providerOptions: {
      openai: {
        serviceTier: 'flex',
        textVerbosity: 'low',
        reasoningSummary: null,
      },
    },
  })

  const assistantMessageId = await sendWhatsappMessage(context.chat, user.waId, response.output)

  context.outbound = toDbMessage({
    userId: user.id,
    assistantWaMessageId: assistantMessageId,
    response,
  })
}

// TODO in production, we should fill with signed URLs instead of raw data
async function fillMediaMessagesWithData(
  recentMessages: Awaited<ReturnType<ZapidRepository['findRecentMessages']>>,
  storage: Storage
) {
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
      const fileData = await storage.retrieve(storageKey)
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
    console.log(
      `fillMediaMessagesWithData: Filling message ${index} with storage key ${storageKey}`
    )
    if (Array.isArray(message.modelMessage.content)) {
      for (const part of message.modelMessage.content) {
        console.log('fillMediaMessagesWithData: Part', JSON.stringify(part, null, 2))
        if ('image' in part) {
          console.log(`fillMediaMessagesWithData: Filling image part for message ${index}`)
          part.image = data.get(storageKey)!
        }
        if ('data' in part) {
          console.log(`fillMediaMessagesWithData: Filling data part for message ${index}`)
          part.data = data.get(storageKey)!
        }
      }
    }
  }
}

function createToolSet() {
  const context = getContext()

  const webSearchTool = createWebSearchTool({ webSearch: context.webSearch })
  const sendReactionTool = createSendReactionTool({
    sendReaction: (emoji) =>
      context.chat.sendReaction(context.user!.waId, {
        emoji,
        targetMessageId: context.inbound!.waId!,
      }),
  })
  const sendTextTool = createSendTextTool({
    userWhatsappId: context.user!.waId,
    sendText: (text) => context.chat.sendText(context.user!.waId, { text }),
  })

  return {
    [webFetchTool.title!]: webFetchTool,
    [webSearchTool.title!]: webSearchTool,
    [sendReactionTool.title!]: sendReactionTool,
    [sendTextTool.title!]: sendTextTool,
    [googlePlacesTool.title!]: googlePlacesTool,
    [updateUserProfileTool.title!]: updateUserProfileTool,
    // TODO
    // fetchMemory
    // searchFiles
    // sendFile - will turn into structured output
  } satisfies ToolSet
}
