import { analyzeImage } from '@batman/core/ai/analyzeImage'
import { generateEmbeddings } from '@batman/core/ai/generateEmbeddings'
import { transcribeDocument } from '@batman/core/ai/transcribeDocument'
import type { DB } from '@batman/core/infra/db'
import { parsePdf } from '@batman/core/utils/parsePdf'
import type { IncomingMessage } from '@batman/whatsapp'
import { getContext } from '../context'

export async function embedInboundMessage(
  inbound: DB.MessageInsert,
  message: IncomingMessage
): Promise<void> {
  const context = getContext()

  if (!inbound.id) return

  const text = await extractText(message)
  if (!text) {
    console.log('No text to embed for inbound message')
    return
  }

  const [embeddingGroup] = await generateEmbeddings([text])
  if (!embeddingGroup) return

  const snippetInserts: Array<DB.SnippetInsert> = embeddingGroup.map((chunk, sequence) => ({
    messageId: inbound.id!,
    sequence,
    content: chunk.content,
    vector: chunk.embedding,
  }))

  await context.db.storeSnippets(snippetInserts)
  console.log(`Embedded inbound message: ${snippetInserts.length} chunks`)
}

async function extractText(message: IncomingMessage): Promise<string | undefined> {
  if (message.type === 'text') {
    return message.text.trim() || undefined
  }

  if (message.type === 'image' && 'data' in message && 'mimeType' in message) {
    const imageUrl = `data:${message.mimeType};base64,${Buffer.from(message.data).toString(
      'base64'
    )}`
    const caption = 'caption' in message ? message.caption : undefined
    const description = await analyzeImage({ imageUrl, caption })
    return description.trim() || undefined
  }

  if (
    message.type === 'document' &&
    'data' in message &&
    'mimeType' in message &&
    'filename' in message
  ) {
    if (message.mimeType === 'application/pdf') {
      const text = await parsePdf(message.data)
      if (text.length > 0) return text
    }
    const transcription = await transcribeDocument({
      document: message.data,
      mimeType: message.mimeType,
      filename: message.filename,
    })
    return transcription.trim() || undefined
  }

  return undefined
}
