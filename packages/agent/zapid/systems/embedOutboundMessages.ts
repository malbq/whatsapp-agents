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

  const lastOutbound = context.outbound[context.outbound.length - 1]
  if (!lastOutbound?.id) {
    console.warn('Last outbound message not found')
    return
  }

  const assistantText = extractText(context.responseOutput)

  if (!assistantText) {
    console.warn('No text to embed for outbound message')
    return
  }

  const messagesWithText = new Map<string, string>()
  messagesWithText.set(lastOutbound.id, assistantText)

  console.debug('Embedding outbound message')

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
  console.debug('Embedded outbound message', {
    chunks: snippetInserts.length,
    messageId: lastOutbound.id,
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
