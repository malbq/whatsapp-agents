import type { Chat, MessageNotification } from '@wa/whatsapp'
import { extractCommand, sendCommandMessage } from './lib/command'

export function createCommandHandler(chat: Chat) {
  return async ({ message, userWaId }: MessageNotification) => {
    chat.acknowledgeMessage(message.messageWaId)

    const command = extractCommand(message)
    if (!command) return

    try {
      await sendCommandMessage(chat, userWaId, command)
    } catch (error) {
      console.error('Error processing command', { command, error })
      await chat.sendText(userWaId, {
        text: 'Sorry, there was a problem processing your command. Please try again.',
      })
    }
  }
}
