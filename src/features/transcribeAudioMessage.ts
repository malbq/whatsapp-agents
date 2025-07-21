import type { AudioMessage, TextMessage, VoiceMessage } from '../domain/message'

export async function transcribeAudioMessage(
  { chat, ai }: Deps,
  message: AudioMessage | VoiceMessage
): Promise<TextMessage> {
  try {
    const { media } = await chat.fetchReceivedMedia(message.mediaId)
    const text = await ai.transcribe({ audio: media })
    return {
      role: 'user',
      type: 'text',
      from: message.from,
      to: message.to,
      body: text,
      timestamp: message.timestamp,
    }
  } catch (error) {
    console.error('transcribeAudioMessage', error)
    throw error
  }
}
