import type { UnsupportedMessage } from '../domain/message'

export async function handleUnsupportedMessage(
  { chat }: Deps,
  message: UnsupportedMessage
) {
  await chat.sendTextMessage({
    from: message.to,
    to: message.from,
    text: 'Me desculpe, mas ainda não consigo responder a este tipo de mensagem.',
    replyingTo: message.id,
  })
}
