import { AI } from '../infra/ai'
import { WA } from '../infra/whatsapp'

export async function handleImageMessage(
  businessPhoneNumberId: string,
  message: WA.ImageMessage
) {
  try {
    const { media, mimeType } = await WA.downloadMedia(message.image.id)
    const base64Image = Buffer.from(await media.arrayBuffer()).toString(
      'base64'
    )
    const imageUrl = `data:${mimeType};base64,${base64Image}`
    const text = await AI.analyzeImage({ imageUrl })
    await WA.sendTextMessage({
      businessPhoneNumberId,
      toPhoneNumber: message.from,
      text,
      replyToMessage: message.id,
    })
  } catch (error) {
    console.error(error)
    await WA.sendTextMessage({
      businessPhoneNumberId,
      toPhoneNumber: message.from,
      text: 'Desculpe, não consegui analisar esta imagem.',
      replyToMessage: message.id,
    })
  }
}
