import { WA } from '../infra/whatsapp'

export async function handleDocumentMessage(
  businessPhoneNumberId: string,
  message: WA.DocumentMessage
) {
  await WA.sendTextMessage({
    businessPhoneNumberId,
    toPhoneNumber: message.from,
    text: 'Em breve poderei ler e guardar seus documentos.',
    replyToMessage: message.id,
  })
}
