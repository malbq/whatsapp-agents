import { openai } from '@ai-sdk/openai'
import { generateWhatsappMessage } from '@batman/core/ai/generateWhatsappMessage'
import { ResponseGenerationError } from '@batman/core/errors'
import { sendWhatsappMessage } from '@batman/core/utils/sendWhatsappMessage'
import { toDbMessage } from '@batman/core/utils/toDbMessage'
import { toSystemModelMessage } from '@batman/core/utils/toModelMessage'
import type { ModelMessage } from 'ai'
import { getContext } from 'context'
import { ok } from 'node:assert'
import { recentMessages as recentMessagesPrompt } from '../prompts/recentMessages'
import { userProfile } from '../prompts/userProfile'

const model = openai.responses('gpt-5-mini-2025-08-07')

export async function responseGeneration() {
  const context = getContext()
  ok(context.user, new ResponseGenerationError('User not found'))
  ok(context.inbound, new ResponseGenerationError('Inbound message not found'))

  const agentContext: Array<ModelMessage> = []

  if (context.user.profile.length > 0) {
    agentContext.push(userProfile(context.user.profile))
    console.log('Context included: user profile')
  }

  await context.db.findRecentMessages({ userId: context.user.id }).then((recentMessages) => {
    if (recentMessages.length === 0) return

    agentContext.push(
      toSystemModelMessage(recentMessagesPrompt),
      ...recentMessages.map((message) => message.modelMessage)
    )
  })

  agentContext.push(context.inbound.modelMessage)

  const response = await generateWhatsappMessage({
    model,
    messages: agentContext,
    // tools: [],
  })

  const assistantMessageId = await sendWhatsappMessage(
    context.chat,
    context.user.waId,
    response.output
  )

  context.outbound = toDbMessage({
    userId: context.user.id,
    assistantWaMessageId: assistantMessageId,
    response,
  })
}
