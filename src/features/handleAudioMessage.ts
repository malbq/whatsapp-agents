import { toFile } from 'openai'
import { AI } from '../infra/ai'
import { WA } from '../infra/whatsapp'

export async function handleAudioMessage(
  businessPhoneNumberId: string,
  message: WA.AudioMessage
) {
  try {
    const { media } = await WA.downloadMedia(message.audio.id)
    const text = await AI.transcribe({
      audio: await toFile(media, '', { type: 'audio/ogg' }),
    })
    await WA.sendTextMessage({
      businessPhoneNumberId,
      toPhoneNumber: message.from,
      text: `Você disse: ${text}`,
      replyToMessage: message.id,
    })
  } catch (error) {
    console.error(error)
    await WA.sendTextMessage({
      businessPhoneNumberId,
      toPhoneNumber: message.from,
      text: 'Desculpe, não consegui transcrever este áudio.',
      replyToMessage: message.id,
    })
  }
}
