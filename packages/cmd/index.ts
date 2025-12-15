import { createServer } from '@batman/server'
import { createWebhookApp, createWhatsappClient } from '@batman/whatsapp'
import { ok } from 'node:assert'
import { extractCommand, helpText } from './lib/command'
import { generate } from './lib/generate'
import pkg from './package.json'

ok(import.meta.env.META_WEBHOOK_VERIFY_TOKEN, 'META_WEBHOOK_VERIFY_TOKEN is required')
ok(import.meta.env.META_API_TOKEN, 'META_API_TOKEN is required')
ok(import.meta.env.META_APP_SECRET, 'META_APP_SECRET is required')
ok(import.meta.env.WA_BUSINESS_PHONE_ID, 'WA_BUSINESS_PHONE_ID is required')

const apiToken = import.meta.env.META_API_TOKEN
const businessPhoneId = import.meta.env.WA_BUSINESS_PHONE_ID
const chat = createWhatsappClient({ apiToken, businessPhoneId })

const appSecret = import.meta.env.META_APP_SECRET
const verifyToken = import.meta.env.META_WEBHOOK_VERIFY_TOKEN

const webhookApp = createWebhookApp(
  chat,
  { appSecret, verifyToken },
  {
    onMessage: async (notification) => {
      const { message, userWaId } = notification
      console.log('message received', message)

      const command = extractCommand(message)
      console.log('command extracted', command)
      if (!command) {
        chat.acknowledgeMessage(message.messageId)
        return
      }

      try {
        chat.sendTypingIndicator(message.messageId)
        if (command === '/help') {
          await chat.sendText(userWaId, { text: helpText })
          return
        }

        const response = await generate(command)

        switch (response.type) {
          case 'text':
            await chat.sendText(userWaId, response)
            break
          case 'location':
            await chat.sendLocation(userWaId, response)
            break
          case 'contact':
            await chat.sendContact(userWaId, response)
            break
          case 'interactive_button':
            await chat.sendInteractiveButton(userWaId, response)
            break
          case 'interactive_list':
            await chat.sendInteractiveList(userWaId, response)
            break
        }
      } catch (error) {
        console.error('Error processing command:', error)
        await chat.sendText(userWaId, {
          text: 'Desculpe, ocorreu um problema ao processar seu comando. Por favor, tente novamente.',
        })
      }
    },
  }
)

const port = parseInt(import.meta.env.PORT || '8080')
const { app, serve } = createServer({ name: 'Command agent', version: pkg.version, port })
app.route('/webhook', webhookApp)

serve()
