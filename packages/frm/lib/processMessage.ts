import type { DB } from '@batman/core/infra/db'
import { sendWhatsappMessage } from '@batman/core/utils/sendWhatsappMessage'
import { toDbMessage, type AssistantTurnResult } from '@batman/core/utils/toDbMessage'
import { toDbTokenUsage } from '@batman/core/utils/toDbUsage'
import { toUserModelMessage } from '@batman/core/utils/toModelMessage'
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

    const { message, userId: userWhatsappId, userName, timestamp } = notification

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
      const assistantMessageId = await deps.chat.sendText(userWhatsappId, response)
      deps.db.storeMessage([
        toDbMessage({
          userId: user.id,
          waId: message.messageId,
          modelMessage: { role: 'user', content: '<error>Unsupported message type</error>' },
          type: 'unsupported',
        }),
        toDbMessage({
          userId: user.id,
          waId: assistantMessageId,
          modelMessage: { role: 'assistant', content: response.text },
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

    const { message: userModelMessage, usage: transcriptionUsage } = await toUserModelMessage(
      message
    )

    const messages: ModelMessage[] = [
      ...recentMessages.flatMap((row) => row.messages),
      userModelMessage,
    ]

    const tools = createTools({
      candidate,
      chat: deps.chat,
      frmDB: deps.frmDB,
    })

    const response = await generate({
      messages,
      tools,
      frmDB: deps.frmDB,
    }).catch(async (error) => {
      console.error('Error generating response:', JSON.stringify(error, null, 2))
      await deps.chat.sendText(userWhatsappId, {
        text: 'Desculpe, ocorreu um problema no processamento da sua solicitação. Tente novamente mais tarde.',
      })
      return null
    })

    if (!response) return

    const assistantMessageId = await sendWhatsappMessage(
      deps.chat,
      userWhatsappId,
      response.output
    ).catch((error) => {
      console.error(error)
      return deps.chat.sendText(userWhatsappId, {
        text: 'Desculpe, ocorreu um erro ao processar a resposta.',
      })
    })

    try {
      // Store inbound user message
      const userMessage = toDbMessage({
        userId: user.id,
        waId: message.messageId,
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

      const [userMessageId, assistantMessageDbId] = await deps.db.storeMessage([
        userMessage,
        assistantTurn.message,
      ])

      if (transcriptionUsage && userMessageId) {
        await deps.db.storeTokenUsage(
          toDbTokenUsage({
            messageId: userMessageId,
            source: 'audio_transcription',
            usage: transcriptionUsage,
          })
        )
      }

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
    } catch (error) {
      console.error('Error storing message:', error)
    }
  }
