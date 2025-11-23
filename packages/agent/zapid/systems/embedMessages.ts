import { analyzeImage } from '@batman/core/ai/analyzeImage'
import { generateEmbeddings } from '@batman/core/ai/generateEmbeddings'
import { transcribeDocument } from '@batman/core/ai/transcribeDocument'
import type { DB } from '@batman/core/infra/db'
import { parsePdf } from '@batman/core/utils/parsePdf'
import type { IncominMessage, OutgoingMessage } from '@batman/whatsapp'
import { ok } from 'node:assert'
import { getContext } from '../context'

export async function embedMessages() {
  const context = getContext()
  const inbound = context.inbound
  ok(inbound?.id, 'Inbound message not found')
  ok(context.responseOutput, 'Response output not found')

  const lastOutbound = context.outbound[context.outbound.length - 1]
  ok(lastOutbound?.id, 'Last outbound message not found')

  const userText = await extractTextFromWhatsappMessage('user', context.notification.message)
  const assistantText = await extractTextFromWhatsappMessage('assistant', context.responseOutput)

  const messagesWithText: Map<string, string> = new Map()

  if (userText) {
    messagesWithText.set(inbound.id, userText)
  }

  if (assistantText) {
    messagesWithText.set(lastOutbound.id, assistantText)
  }

  if (messagesWithText.size === 0) {
    console.log('No text messages to embed')
    return
  }

  console.log(`Embedding ${messagesWithText.size} messages`)

  const embeddingGroups = await generateEmbeddings(messagesWithText.values().toArray())
  const snippetInserts: Array<DB.SnippetInsert> = []

  messagesWithText.keys().forEach((messageId, i) => {
    const embeddingGroup = embeddingGroups[i]!
    let chunkSequence = 0
    for (const chunk of embeddingGroup) {
      snippetInserts.push({
        messageId,
        sequence: chunkSequence++,
        content: chunk.content,
        vector: chunk.embedding,
      })
    }
  })

  await context.db.storeSnippets(snippetInserts)
  console.log(
    `Stored ${snippetInserts.length} snippet chunks across ${messagesWithText.size} messages`
  )
}

async function extractTextFromWhatsappMessage(
  role: 'user' | 'assistant',
  message: IncominMessage | OutgoingMessage
): Promise<string | undefined> {
  if (message.type === 'text' && 'text' in message) {
    return message.text.trim() || undefined
  }

  if (
    (message.type === 'interactive_list' ||
      message.type === 'interactive_button' ||
      message.type === 'interactive_cta_url') &&
    'body' in message
  ) {
    return message.body.trim() || undefined
  }

  if (role === 'user' && message.type === 'image' && 'data' in message && 'mimeType' in message) {
    try {
      const imageUrl = `data:${message.mimeType};base64,${Buffer.from(message.data).toString(
        'base64'
      )}`
      const caption = 'caption' in message ? message.caption : undefined
      const description = await analyzeImage({ imageUrl, caption })
      return description.trim() || undefined
    } catch (error) {
      console.error('Failed to analyze image for embedding', error)
      return undefined
    }
  }

  if (
    role === 'user' &&
    message.type === 'document' &&
    'data' in message &&
    'mimeType' in message &&
    'filename' in message
  ) {
    try {
      const transcription = await parseDocument(message.data, message.mimeType, message.filename)
      return transcription.trim() || undefined
    } catch (error) {
      console.error('Failed to parse document for embedding', error)
      return undefined
    }
  }

  return undefined
}

async function parseDocument(
  document: ArrayBuffer,
  mimeType: string,
  filename: string
): Promise<string> {
  if (mimeType === 'application/pdf') {
    const text = await parsePdf(document)
    if (text.length > 0) {
      return text
    }
  }
  return await transcribeDocument({
    document,
    mimeType,
    filename,
  })
}
