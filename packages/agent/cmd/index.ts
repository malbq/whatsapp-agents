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
      const { message, userId } = notification

      const command = extractCommand(message)
      console.log('command extracted', command)
      if (!command) {
        chat.acknowledgeMessage(message.messageId)
        return
      }

      try {
        chat.sendTypingIndicator(message.messageId)
        if (command === '/help') {
          await chat.sendText(userId, { text: helpText })
          return
        }

        const response = await generate(command, chat, userId, message.messageId)

        switch (response.type) {
          case 'text':
            await chat.sendText(userId, { text: response.text })
            break
          case 'location':
            await chat.sendLocation(userId, {
              latitude: response.latitude,
              longitude: response.longitude,
              name: response.name,
              address: response.address,
            })
            break
          case 'contact':
            await chat.sendContact(userId, {
              name: response.name,
              phone: response.phone,
            })
            break
          case 'interactive':
            if (response.options.length <= 3) {
              await chat.sendInteractiveButton(userId, {
                body: response.text,
                buttons: response.options,
              })
            } else {
              await chat.sendInteractiveList(userId, {
                body: response.text,
                openListButton: response.openListLabel,
                sections: [
                  {
                    options: response.options.map((option) => ({
                      title: option,
                    })),
                  },
                ],
              })
            }
            break
        }
      } catch (error) {
        console.error('Error processing command:', error)
        await chat.sendText(userId, {
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
