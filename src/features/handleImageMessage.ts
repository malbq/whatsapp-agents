import type { ImageMessage } from '../domain/message'

export async function handleImageMessage(
  { chat, ai }: Deps,
  message: ImageMessage
) {
  try {
    const { media, mimeType } = await chat.fetchReceivedMedia(message.mediaId)
    const base64Image = Buffer.from(media).toString('base64')
    const imageUrl = `data:${mimeType};base64,${base64Image}`
    const text = await ai.analyzeImage({ imageUrl, caption: message.caption })
    await chat.sendTextMessage({
      from: message.to,
      to: message.from,
      text,
      replyingTo: message.id,
    })
  } catch (error) {
    console.error(error)
    await chat.sendTextMessage({
      from: message.to,
      to: message.from,
      text: 'Desculpe, não consegui analisar esta imagem.',
      replyingTo: message.id,
    })
  }
}
