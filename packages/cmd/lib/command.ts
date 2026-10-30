import type { Chat, IncomingMessage } from '@batman/whatsapp'

const commands = ['help', 'text', 'contact', 'location', 'options'] as const
export type Command = (typeof commands)[number]
export function extractCommand(message: IncomingMessage): string | null {
  if (message.type !== 'text' || !message.text) return null
  const match = message.text.match(/^\/(help|text|contact|location|options \d+)$/)
  if (!match) return null
  return message.text
}

export const helpText = `Available commands:
/help - Show this help
/text - Test text sending
/contact - Test contact sending
/location - Test location sending
/options {N} - Test interactive list of {N} options`

export async function sendCommandMessage(
  chat: Chat,
  userId: string,
  command: string
): Promise<string> {
  switch (command) {
    case '/help':
      return chat.sendText(userId, { text: helpText })
    case '/text':
      return chat.sendText(userId, { text: 'Echo test message sent successfully!' })
    case '/contact':
      return chat.sendContact(userId, {
        name: 'John Doe',
        phone: '+1234567890',
      })
    case '/location':
      return chat.sendLocation(userId, {
        latitude: -23.55052,
        longitude: -46.633308,
        name: 'São Paulo, Brazil',
        address: 'São Paulo, State of São Paulo, Brazil',
      })
    case '/list':
      return chat.sendInteractiveList(userId, {
        header: 'Choose an option',
        body: 'Please select one of the following options:',
        footer: 'Powered by `batman`',
        openListButton: 'Select Option',
        sections: [
          {
            title: 'Basic Options',
            options: [
              {
                title: 'Option 1',
                description: 'This is the first option',
              },
              {
                title: 'Option 2',
                description: 'This is the second option',
              },
            ],
          },
          {
            title: 'Advanced Options',
            options: [
              {
                title: 'Option 3',
                description: 'This is an advanced option',
              },
              {
                title: 'Option 4',
                description: 'Another advanced option',
              },
            ],
          },
        ],
      })
    case '/button':
      return chat.sendInteractiveButton(userId, {
        header: 'Quick Actions',
        body: 'Choose one of the following options:',
        footer: 'Powered by `batman`',
        buttons: ['Yes', 'No', 'Maybe'],
      })
    case '/cta':
      return chat.sendInteractiveCtaUrl(userId, {
        header: 'Visit Our Website',
        body: 'Check out our latest offers and products!',
        footer: 'Tap below to visit',
        action: {
          text: 'Open Website',
          url: 'https://malbq.dev',
        },
      })
    default:
      return chat.sendText(userId, {
        text: `Unknown command: /${command}. Type /help for available commands.`,
      })
  }
}
