import { WA } from '../infra/whatsapp'

export async function handleUnsupportedMessage(
  businessPhoneNumberId: string,
  message: WA.Message
) {
  await WA.sendTextMessage({
    businessPhoneNumberId,
    toPhoneNumber: message.from,
    text: 'Me desculpe, mas ainda não consigo responder a este tipo de mensagem.',
    replyToMessage: message.id,
  })
}
