import type { DocumentMessage } from '../domain/message'

export async function handleDocumentMessage(
  { chat }: Deps,
  message: DocumentMessage
) {
  await chat.sendTextMessage({
    from: message.to,
    to: message.from,
    text: 'Em breve poderei ler e guardar seus documentos.',
    replyingTo: message.id,
  })
}
