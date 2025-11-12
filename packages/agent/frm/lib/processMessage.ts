import type { DB } from '@batman/core/infra/db'
import { toDbMessage } from '@batman/core/utils/toDbMessage'
import { toAssistantModelMessage } from '@batman/core/utils/toModelMessage'
import type { Chat, MessageNotification, TextMessage } from '@batman/whatsapp'
import type { ModelMessage } from 'ai'
import { createTools } from '../tools'
import { findCandidateByPhone } from './dataStore'
import { generate } from './generate'

export interface ProcessMessageDeps {
  db: DB.Repository
  chat: Chat
}

export const processMessage =
  (deps: ProcessMessageDeps) => async (notification: MessageNotification) => {
    console.log('FRM Agent processing notification:', notification)

    const { message, userId: userWhatsappId, userName } = notification

    const ackPromise = deps.chat.acknowledgeMessage(message.messageId)

    const candidate = findCandidateByPhone(userWhatsappId)
    if (!candidate) {
      deps.chat.sendText(userWhatsappId, {
        text: 'Desculpe, não encontramos seu cadastro. Por favor, entre em contato com o RH.',
      })
      return
    }

    const user = await deps.db
      .persistUser({ waId: userWhatsappId, name: userName })
      .catch((error) => {
        deps.chat.sendText(userWhatsappId, {
          text: 'Desculpe, tive um problema ao processar sua mensagem e não consigo te responder agora.',
        })
        console.error('Error persisting user:', error)
        return null
      })

    if (!user) return

    if (message.type !== 'text') {
      const response: TextMessage = {
        type: 'text',
        text: 'Desculpe, não entendo este tipo de mensagem. Por favor, envie uma mensagem de texto.',
      }
      deps.chat.sendText(userWhatsappId, response)
      deps.db.storeMessage([
        toDbMessage({
          userId: user.id,
          waId: message.messageId,
          modelMessage: {
            role: 'user',
            content: 'Error: Unsupported message type',
          },
          type: 'unsupported',
        }),
        toDbMessage({
          userId: user.id,
          modelMessage: toAssistantModelMessage(response),
        }),
      ])
      return
    }

    const recentMessages = await deps.db
      .findRecentMessages({ userId: user.id })
      .catch((error: unknown) => {
        console.error('Error finding recent messages:', error)
        return []
      })

    const messages: ModelMessage[] = [
      ...recentMessages.map((msg) => msg.modelMessage),
      { role: 'user', content: message.text },
    ]

    const tools = createTools({
      userWhatsappId,
      chat: deps.chat,
      candidate,
    })
    let responseText: string
    try {
      const generateResponse = await generate({
        messages,
        tools,
      })
      responseText = generateResponse.text
    } catch (error) {
      console.error('Error generating response:', JSON.stringify(error, null, 2))
      await deps.chat.sendText(userWhatsappId, {
        text: 'Desculpe, ocorreu um problema no processamento da sua solicitação. Tente novamente mais tarde.',
      })
      return
    }

    const assistantMessageId = await deps.chat.sendText(userWhatsappId, { text: responseText })

    try {
      await deps.db.storeMessage([
        {
          userId: user.id,
          waId: message.messageId,
          type: message.type,
          modelMessage: { role: 'user', content: message.text },
          content: [{ content: message.text, embedding: [] }],
        },
        {
          userId: user.id,
          waId: assistantMessageId,
          type: 'text',
          modelMessage: { role: 'assistant', content: responseText },
          content: [{ content: responseText, embedding: [] }],
        },
      ])
    } catch (error) {
      console.error('Error storing message:', error)
    } finally {
      const { saveData } = await import('./dataStore')
      await Promise.all([ackPromise, saveData()])
    }
  }
