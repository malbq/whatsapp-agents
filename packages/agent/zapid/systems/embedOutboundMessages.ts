import { generateEmbeddings } from '@batman/core/ai/generateEmbeddings'
import type { DB } from '@batman/core/infra/db'
import type { OutgoingMessage } from '@batman/whatsapp'
import { getContext } from '../context'

export async function embedOutboundMessages() {
  const context = getContext()
  if (!context.responseOutput) {
    console.warn('Response output not found')
    return
  }

  // Get the message ID from the bundled assistant turn
  const messageId = context.outbound?.message.id
  if (!messageId) {
    console.warn('Outbound message not found or not stored')
    return
  }

  const assistantText = extractText(context.responseOutput)

  if (!assistantText) {
    console.warn('No text to embed for outbound message')
    return
  }

  console.debug('Embedding outbound message')

  const [embeddingGroup] = await generateEmbeddings([assistantText])
  if (!embeddingGroup) return

  const snippetInserts: Array<DB.SnippetInsert> = embeddingGroup.map((chunk, sequence) => ({
    messageId,
    sequence,
    content: chunk.content,
    vector: chunk.embedding,
  }))

  await context.db.storeSnippets(snippetInserts)
  console.debug('Embedded outbound message', {
    chunks: snippetInserts.length,
    messageId,
  })
}

function extractText(message: OutgoingMessage): string | undefined {
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

  return undefined
}
