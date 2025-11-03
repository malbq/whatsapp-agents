import type { User } from '@batman/core/infra/db'
import { ingestMessage } from '@batman/core/ingestion/ingestMessage'
import { createServer } from '@batman/server'
import type { MessageNotification } from '@batman/whatsapp'
import { createWebhookApp } from '@batman/whatsapp'
import { generateText, stepCountIs, type ModelMessage, type Tool } from 'ai'
import { ok } from 'node:assert'
import { chat, config, dataStore, db, languageModel, saveData } from './config'
import { createSystemPrompt } from './prompts/system'
import { createCancelInterviewTool } from './tools/cancelInterview'
import { createConfirmDateTimeTool } from './tools/confirmDateTime'
import { createConsultScheduleTool } from './tools/consultSchedule'
import { createRescheduleInterviewTool } from './tools/rescheduleInterview'
import { createScheduleInterviewTool } from './tools/scheduleInterview'
import type { FrmToolContext } from './types'

ok(import.meta.env.META_WEBHOOK_VERIFY_TOKEN, 'META_WEBHOOK_VERIFY_TOKEN is required')
ok(import.meta.env.META_API_TOKEN, 'META_API_TOKEN is required')
ok(import.meta.env.META_APP_SECRET, 'META_APP_SECRET is required')
ok(import.meta.env.WA_BUSINESS_PHONE_ID, 'WA_BUSINESS_PHONE_ID is required')
ok(import.meta.env.CF_ACCOUNT_ID, 'CF_ACCOUNT_ID is required')
ok(import.meta.env.CF_API_TOKEN, 'CF_API_TOKEN is required')

async function respond(params: {
  messages: Array<{ role: string; content: string | Array<unknown> }>
  tools: Tool[]
}): Promise<string> {
  const result = await generateText({
    model: languageModel,
    system: createSystemPrompt(dataStore),
    messages: params.messages.map((msg) => ({
      role: msg.role as 'system' | 'user' | 'assistant',
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
    })),
    tools: Object.fromEntries(
      params.tools.map((tool) => [(tool as unknown as { name: string }).name, tool])
    ),
    stopWhen: stepCountIs(config.MAX_STEPS),
  })

  return result.text
}

const createToolContext = (userWhatsappId: string): FrmToolContext => ({
  userWhatsappId,
  dataStore,
  saveData,
  chat,
})

const createTools = (userWhatsappId: string) => [
  createConsultScheduleTool(createToolContext(userWhatsappId)),
  createConfirmDateTimeTool(createToolContext(userWhatsappId)),
  createScheduleInterviewTool(createToolContext(userWhatsappId)),
  createCancelInterviewTool(createToolContext(userWhatsappId)),
  createRescheduleInterviewTool(createToolContext(userWhatsappId)),
]

const processMessage = async (notification: MessageNotification): Promise<void> => {
  console.log('FRM Agent processing notification:', notification)

  const { message, userId, userName } = notification

  const ackPromise = chat.acknowledgeMessage(message.messageId)

  let user: User
  try {
    user = await db.persistUser({ externalId: userId, name: userName })
  } catch (error) {
    chat.sendText(notification.userId, {
      text: 'Desculpe, tive um problema ao processar sua mensagem e não consigo te responder agora.',
    })
    console.error('FRM Agent error:', error)
    return
  }

  if (message.type !== 'text') {
    chat.sendText(notification.userId, {
      text: 'Desculpe, não entendo este tipo de mensagem. Por favor, envie uma mensagem de texto.',
    })
    return
  }

  const ingestedMessage = await ingestMessage(message)

  const recentMessages = await db.findRecentMessages({ userId: user.id })
  const conversationMessages: ModelMessage[] = [
    ...recentMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    ingestedMessage,
  ]

  try {
    const tools = createTools(notification.userId)

    const responseText = await respond({
      messages: conversationMessages,
      tools,
    })

    const assistantMessageId = await chat.sendText(notification.userId, { text: responseText })

    const storeMessagePromise = db.storeMessage([
      {
        userId: user.id,
        role: ingestedMessage.role,
        externalId: message.messageId,
        type: message.type,
        content: [
          {
            content: ingestedMessage.content as string,
            embedding: [],
          },
        ],
      },
      {
        userId: user.id,
        role: 'assistant',
        externalId: assistantMessageId,
        type: 'text',
        content: [
          {
            content: responseText,
            embedding: [],
          },
        ],
      },
    ])
    await Promise.all([ackPromise, storeMessagePromise, saveData()])
  } catch (error) {
    console.error('FRM Agent error:', error)

    const fallbackMessage =
      'Desculpe, ocorreu um problema no processamento da sua solicitação. Tente novamente mais tarde.'
    await chat.sendText(notification.userId, { text: fallbackMessage })

    await saveData()
  }
}

const server = createServer({ port: parseInt(config.PORT) })
const app = server.getApp()

const webhookApp = createWebhookApp(
  chat,
  {
    appSecret: config.META_APP_SECRET,
    verifyToken: config.META_WEBHOOK_VERIFY_TOKEN,
  },
  {
    onMessage: processMessage,
  }
)

app.route('/webhook', webhookApp)

console.log(`🚀 FRM Agent starting on port ${config.PORT}`)
const builtServer = server.build()
Bun.serve({
  port: builtServer.port,
  fetch: builtServer.fetch,
})
