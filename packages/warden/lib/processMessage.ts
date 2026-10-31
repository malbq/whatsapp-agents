import { toDbMessage, type AssistantTurnResult } from '@wa/core/utils/toDbMessage'
import { toDbTokenUsage } from '@wa/core/utils/toDbUsage'
import type { Chat, MessageNotification, TextMessage } from '@wa/whatsapp'
import type { LanguageModel, ModelMessage, UserModelMessage } from 'ai'
import type { CalendarAdapter } from '../calendar/types'
import type { WardenDB } from '../db'
import { createTools } from '../tools'
import { generate } from './generate'

export interface ProcessMessageDeps {
  db: WardenDB
  chat: Chat
  calendar: CalendarAdapter
  model: LanguageModel
}

const logError = (context: string) => (error: unknown) => console.error(context, error)

export const processMessage =
  (deps: ProcessMessageDeps) => async (notification: MessageNotification) => {
    console.log('Warden Agent processing notification:', notification)

    const { message, userWaId, userName, timestamp } = notification

    deps.chat
      .acknowledgeMessage(message.messageWaId)
      .catch(logError('Error acknowledging message:'))

    const user = await deps.db.persistUser({ waId: userWaId, name: userName }).catch((error) => {
      deps.chat
        .sendText(userWaId, {
          text: "Sorry, I had a problem processing your message and can't reply right now.",
        })
        .catch(logError('Error sending failure reply:'))
      console.error('Error persisting user:', error)
      return null
    })

    if (!user) return

    if (message.type !== 'text') {
      const response: TextMessage = {
        type: 'text',
        text: "Sorry, I don't understand this type of message. Please send a text message.",
      }
      const assistantMessageId = await deps.chat.sendText(userWaId, response)
      await deps.db
        .storeMessage([
          toDbMessage({
            userId: user.id,
            waId: message.messageWaId,
            modelMessage: { role: 'user', content: '<error>Unsupported message type</error>' },
            type: 'unsupported',
          }),
          toDbMessage({
            userId: user.id,
            waId: assistantMessageId,
            modelMessage: { role: 'assistant', content: response.text },
          }),
        ])
        .catch(logError('Error storing unsupported message:'))
      return
    }

    deps.chat
      .sendTypingIndicator(message.messageWaId)
      .catch(logError('Error sending typing indicator:'))

    const recentMessages = await deps.db
      .findRecentMessages({ userId: user.id })
      .catch((error: unknown) => {
        console.error('Error finding recent messages:', error)
        return []
      })

    const userModelMessage: UserModelMessage = {
      role: 'user',
      content: [{ type: 'text', text: message.text }],
    }

    const messages: ModelMessage[] = [
      ...recentMessages.flatMap((row) => row.messages),
      userModelMessage,
    ]

    const tools = createTools({
      userId: user.id,
      userName: user.name,
      userPhone: userWaId,
      calendar: deps.calendar,
      db: deps.db,
    })

    const response = await generate({ model: deps.model, messages, tools, db: deps.db }).catch(
      async (error) => {
        console.error('Error generating response:', JSON.stringify(error, null, 2))
        await deps.chat.sendText(userWaId, {
          text: 'Sorry, there was a problem processing your request. Please try again later.',
        })
        return null
      }
    )

    if (!response) return

    // For PoC, we only handle text messages
    const assistantMessageId = await (async () => {
      if (response.output.type === 'text') {
        return deps.chat.sendText(userWaId, { text: response.output.text })
      }
      // For non-text messages in PoC, convert to text description
      console.warn('Non-text output type, converting to text:', response.output.type)
      return deps.chat.sendText(userWaId, {
        text: 'Response processed successfully.',
      })
    })().catch((error) => {
      console.error(error)
      return deps.chat.sendText(userWaId, {
        text: 'Sorry, an error occurred while processing the response.',
      })
    })

    // Store inbound user message
    const userMessage = toDbMessage({
      userId: user.id,
      waId: message.messageWaId,
      type: message.type,
      modelMessage: userModelMessage,
      timestamp,
    })

    // Store bundled assistant response
    const assistantTurn: AssistantTurnResult = toDbMessage({
      userId: user.id,
      assistantWaMessageId: assistantMessageId,
      response,
    })

    const [, assistantMessageDbId] = await deps.db.storeMessage([
      userMessage,
      assistantTurn.message,
    ])

    if (assistantTurn.usages.length > 0 && assistantMessageDbId) {
      const usageInserts = assistantTurn.usages.map((u) =>
        toDbTokenUsage({
          messageId: assistantMessageDbId,
          source: u.source,
          modelMessageIndex: u.modelMessageIndex,
          usage: u.usage,
        })
      )
      await deps.db.storeTokenUsage(usageInserts)
    }
  }
