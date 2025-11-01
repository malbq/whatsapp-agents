import type { Chat, IncomingMessage } from './chat'

export function extractCommand(message: IncomingMessage): string | null {
  if (message.type !== 'text' || !message.text) return null
  const match = message.text.match(/^\/(\w+)$/)
  return match && match[1] ? match[1] : null
}

export async function sendCommandMessage(
  chat: Chat,
  command: string,
  userMessageId: string
): Promise<string> {
  switch (command) {
    case 'help':
      return chat.sendText({
        text: `Available commands:
/help - Show this help
/text - Test text sending
/image - Test image sending
/document - Test document sending
/sticker - Test sticker sending
/contact - Test contact sending
/location - Test location sending
/list - Test interactive list sending
/button - Test interactive button sending
/cta - Test interactive CTA URL sending
/template - Test template sending`,
      })
    case 'text':
      return chat.sendText({ text: 'Echo test message sent successfully!' })
    case 'reaction':
      return chat.sendReaction({
        externalChatId: userMessageId,
        emoji: '😊',
      })
    case 'contact':
      return chat.sendContact({
        name: 'John Doe',
        phone: '+1234567890',
      })
    case 'location':
      return chat.sendLocation({
        latitude: -23.55052,
        longitude: -46.633308,
        name: 'São Paulo, Brazil',
        address: 'São Paulo, State of São Paulo, Brazil',
      })
    case 'list':
      return chat.sendInteractiveList({
        header: {
          type: 'text',
          text: 'Choose an option',
        },
        body: {
          text: 'Please select one of the following options:',
        },
        footer: {
          text: 'footer text',
        },
        action: {
          button: 'Select Option',
          sections: [
            {
              title: 'Basic Options',
              rows: [
                {
                  id: 'option_1',
                  title: 'Option 1',
                  description: 'This is the first option',
                },
                {
                  id: 'option_2',
                  title: 'Option 2',
                  description: 'This is the second option',
                },
              ],
            },
            {
              title: 'Advanced Options',
              rows: [
                {
                  id: 'option_3',
                  title: 'Option 3',
                  description: 'This is an advanced option',
                },
                {
                  id: 'option_4',
                  title: 'Option 4',
                  description: 'Another advanced option',
                },
              ],
            },
          ],
        },
      })
    case 'button':
      return chat.sendInteractiveButton({
        header: {
          type: 'text',
          text: 'Quick Actions',
        },
        body: {
          text: 'Choose one of the following options:',
        },
        footer: {
          text: 'Powered by Zapid',
        },
        action: {
          buttons: [
            {
              type: 'reply',
              reply: {
                id: 'yes_button',
                title: 'Yes',
              },
            },
            {
              type: 'reply',
              reply: {
                id: 'no_button',
                title: 'No',
              },
            },
            {
              type: 'reply',
              reply: {
                id: 'maybe_button',
                title: 'Maybe',
              },
            },
          ],
        },
      })
    case 'cta':
      return chat.sendInteractiveCtaUrl({
        header: {
          type: 'text',
          text: 'Visit Our Website',
        },
        body: {
          text: 'Check out our latest offers and products!',
        },
        footer: {
          text: 'Tap below to visit',
        },
        action: {
          name: 'cta_url',
          parameters: {
            display_text: 'Open Website',
            url: 'https://malbq.dev',
          },
        },
      })
    case 'template':
      return chat.sendTemplate({
        name: 'event_details_reminder_1',
        language: 'pt_BR',
        bodyParameters: ['Aniversário de Monique', '10/10/2025 07:00'],
      })
    case 'flow':
      return chat.sendText({
        text: 'Flow test: This would send a flow message if we had flow data available.',
      })
    default:
      return chat.sendText({
        text: `Unknown command: /${command}. Type /help for available commands.`,
      })
  }
}
