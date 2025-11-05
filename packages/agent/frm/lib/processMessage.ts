import type { DB, User } from '@batman/core/infra/db'
import type { Chat, MessageNotification } from '@batman/whatsapp'
import type { ModelMessage } from 'ai'
import { createTools } from '../tools'
import { findCandidateByPhone } from './dataStore'
import { generate } from './generate'

export interface ProcessMessageDeps {
  db: DB
  chat: Chat
}

export const processMessage =
  (deps: ProcessMessageDeps) => async (notification: MessageNotification) => {
    console.log('FRM Agent processing notification:', notification)

    const { message, userId: userWhatsappId, userName } = notification

    const ackPromise = deps.chat.acknowledgeMessage(message.messageId)

    // Find candidate by phone number
    const candidate = findCandidateByPhone(userWhatsappId)
    if (!candidate) {
      deps.chat.sendText(userWhatsappId, {
        text: 'Desculpe, não encontramos seu cadastro. Por favor, entre em contato com o RH.',
      })
      return
    }

    let user: User
    try {
      user = await deps.db.persistUser({ externalId: userWhatsappId, name: userName })
    } catch (error) {
      deps.chat.sendText(userWhatsappId, {
        text: 'Desculpe, tive um problema ao processar sua mensagem e não consigo te responder agora.',
      })
      console.error('Error persisting user:', error)
      return
    }

    if (message.type !== 'text') {
      deps.chat.sendText(userWhatsappId, {
        text: 'Desculpe, não entendo este tipo de mensagem. Por favor, envie uma mensagem de texto.',
      })
      return
    }

    const recentMessages = await deps.db.findRecentMessages({ userId: user.id }).catch((error) => {
      console.error('Error finding recent messages:', error)
      return []
    })

    const messages: ModelMessage[] = [
      ...recentMessages.map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message.text },
    ]

    let responseText: string
    try {
      const tools = createTools({
        userWhatsappId,
        chat: deps.chat,
        candidate,
      })
      responseText = await generate({
        messages,
        tools,
      })
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
          role: 'user',
          externalId: message.messageId,
          type: message.type,
          content: [{ content: message.text, embedding: [] }],
        },
        {
          userId: user.id,
          role: 'assistant',
          externalId: assistantMessageId,
          type: 'text',
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
