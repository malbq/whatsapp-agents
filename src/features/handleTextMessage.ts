import { AI } from '../infra/ai'
import { WA } from '../infra/whatsapp'

export async function handleTextMessage(
  businessPhoneNumberId: string,
  message: WA.TextMessage
) {
  await WA.sendTextMessage({
    businessPhoneNumberId,
    toPhoneNumber: message.from,
    text: await AI.respond({ input: message.text.body }),
    replyToMessage: message.id,
  })
}
