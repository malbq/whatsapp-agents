import type { Chat } from '@batman/whatsapp'
import type { GeneratedWhatsappMessage } from '../ai/generateWhatsappMessage'

export async function sendWhatsappMessage(
  chat: Chat,
  userWaId: string,
  message: GeneratedWhatsappMessage
): Promise<string> {
  switch (message.type) {
    case 'text': {
      const { type: _type, ...rest } = message
      return chat.sendText(userWaId, rest)
    }
    case 'location': {
      const { type: _type, ...rest } = message
      return chat.sendLocation(userWaId, rest)
    }
    case 'contact': {
      const { type: _type, ...rest } = message
      return chat.sendContact(userWaId, rest)
    }
    case 'interactive_button': {
      const { type: _type, ...rest } = message
      return chat.sendInteractiveButton(userWaId, rest)
    }
    case 'interactive_list': {
      const { type: _type, ...rest } = message
      return chat.sendInteractiveList(userWaId, rest)
    }
    default: {
      // Prevent forgetting to handle a message type: Type '{ type: "video"; ... }' is not assignable to type 'never'
      const _exhaustive: never = message
      throw new Error(`Unsupported message type: ${(message as GeneratedWhatsappMessage).type}`)
    }
  }
}
