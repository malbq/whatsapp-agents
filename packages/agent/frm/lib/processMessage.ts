import type { DB } from '@batman/core/infra/db'
import { toDbMessage } from '@batman/core/utils/toDbMessage'
import { toAssistantModelMessage, toUserModelMessage } from '@batman/core/utils/toModelMessage'
import type { Chat, MessageNotification, TextMessage } from '@batman/whatsapp'
import type { ModelMessage } from 'ai'
import type { FrmDB } from '../db'
import { createTools } from '../tools'
import { generate } from './generate'

export interface ProcessMessageDeps {
  db: DB.Repository
  frmDB: FrmDB
  chat: Chat
}

export const processMessage =
  (deps: ProcessMessageDeps) => async (notification: MessageNotification) => {
    console.log('FRM Agent processing notification:', notification)

    const { message, userId: userWhatsappId, userName } = notification

    deps.chat.acknowledgeMessage(message.messageId)

    const candidate = await deps.frmDB.findCandidateByPhone(userWhatsappId)
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

    deps.chat.sendTypingIndicator(message.messageId)

    const recentMessages = await deps.db
      .findRecentMessages({ userId: user.id })
      .catch((error: unknown) => {
        console.error('Error finding recent messages:', error)
        return []
      })

    const userModelMessage = await toUserModelMessage(message)
    const messages: ModelMessage[] = [
      ...recentMessages.map((msg) => msg.modelMessage),
      userModelMessage,
    ]

    const tools = createTools({
      userWhatsappId,
      chat: deps.chat,
      candidate,
      frmDB: deps.frmDB,
    })

    let generateResponse
    try {
      generateResponse = await generate({
        messages,
        tools,
        frmDB: deps.frmDB,
      })
    } catch (error) {
      console.error('Error generating response:', JSON.stringify(error, null, 2))
      await deps.chat.sendText(userWhatsappId, {
        text: 'Desculpe, ocorreu um problema no processamento da sua solicitação. Tente novamente mais tarde.',
      })
      return
    }

    const outputMessage = generateResponse.output
    let assistantMessageId: string

    // Send appropriate message type based on structured output
    switch (outputMessage.type) {
      case 'text':
        assistantMessageId = await deps.chat.sendText(userWhatsappId, { text: outputMessage.text })
        break
      case 'location':
        assistantMessageId = await deps.chat.sendLocation(userWhatsappId, outputMessage)
        break
      case 'contact':
        assistantMessageId = await deps.chat.sendContact(userWhatsappId, outputMessage)
        break
      case 'interactive_button':
        assistantMessageId = await deps.chat.sendInteractiveButton(userWhatsappId, outputMessage)
        break
      case 'interactive_list':
        assistantMessageId = await deps.chat.sendInteractiveList(userWhatsappId, outputMessage)
        break
      default:
        console.error('Unsupported message type:', outputMessage)
        assistantMessageId = await deps.chat.sendText(userWhatsappId, {
          text: 'Desculpe, ocorreu um erro ao processar a resposta.',
        })
    }

    try {
      const messagesToStore = [
        toDbMessage({
          userId: user.id,
          waId: message.messageId,
          type: message.type,
          modelMessage: userModelMessage,
        }),
        ...generateResponse.messages.map((enrichedMsg, i, arr) =>
          toDbMessage({
            userId: user.id,
            waId: i === arr.length - 1 ? assistantMessageId : undefined,
            type:
              i === arr.length - 1
                ? outputMessage.type
                : enrichedMsg.modelMessage.role === 'tool'
                ? 'tool-result'
                : 'tool-call',
            modelMessage: enrichedMsg.modelMessage,
            usage: enrichedMsg.usage,
          })
        ),
      ]

      await deps.db.storeMessage(messagesToStore)
    } catch (error) {
      console.error('Error storing message:', error)
    }
  }
