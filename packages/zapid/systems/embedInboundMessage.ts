import { analyzeImage } from '@wa/core/ai/analyzeImage'
import { generateEmbeddings } from '@wa/core/ai/generateEmbeddings'
import { transcribeDocument } from '@wa/core/ai/transcribeDocument'
import type { DB } from '@wa/core/infra/db'
import { parsePdf } from '@wa/core/utils/parsePdf'
import { toDbTokenUsage } from '@wa/core/utils/toDbUsage'
import type { IncomingMessage } from '@wa/whatsapp'
import type { LanguageModelUsage } from 'ai'
import { getContext } from '../context'

interface ExtractTextResult {
  text: string
  usage?: LanguageModelUsage
  source?: DB.UsageSource
}

export async function embedInboundMessage(
  inbound: DB.MessageInsert,
  message: IncomingMessage
): Promise<void> {
  const context = getContext()

  if (!inbound.id) return

  const result = await extractText(message)
  if (!result) {
    console.warn('No text to embed for inbound message')
    return
  }

  if (result.usage && result.source) {
    await context.db.storeTokenUsage(
      toDbTokenUsage({
        messageId: inbound.id,
        source: result.source,
        usage: result.usage,
      })
    )
    console.debug(`Stored ${result.source} usage`, { messageId: inbound.id })
  }

  const [embeddingGroup] = await generateEmbeddings([result.text])
  if (!embeddingGroup) return

  const snippetInserts: Array<DB.SnippetInsert> = embeddingGroup.map((chunk, sequence) => ({
    messageId: inbound.id!,
    sequence,
    content: chunk.content,
    vector: chunk.embedding,
  }))

  await context.db.storeSnippets(snippetInserts)
  console.debug('Embedded inbound message', {
    snippetsLength: snippetInserts.length,
    messageId: inbound.id,
  })
}

async function extractText(message: IncomingMessage): Promise<ExtractTextResult | undefined> {
  if (message.type === 'text') {
    const text = message.text.trim()
    return text ? { text } : undefined
  }

  if (message.type === 'image' && 'data' in message && 'mimeType' in message) {
    const imageUrl = `data:${message.mimeType};base64,${Buffer.from(message.data).toString(
      'base64'
    )}`
    const caption = 'caption' in message ? message.caption : undefined
    const result = await analyzeImage({ imageUrl, caption })
    const text = result.text.trim()
    return text ? { text, usage: result.usage, source: 'image_analysis' } : undefined
  }

  if (
    message.type === 'document' &&
    'data' in message &&
    'mimeType' in message &&
    'filename' in message
  ) {
    if (message.mimeType === 'application/pdf') {
      const text = await parsePdf(message.data)
      if (text.length > 0) return { text }
    }
    const result = await transcribeDocument({
      document: message.data,
      mimeType: message.mimeType,
      filename: message.filename,
    })
    const text = result.text.trim()
    return text ? { text, usage: result.usage, source: 'document_transcription' } : undefined
  }

  return undefined
}
