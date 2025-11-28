import { generateEmbeddings } from '@batman/core/ai/generateEmbeddings'
import type { DB } from '@batman/core/infra/db'
import type { OutgoingMessage } from '@batman/whatsapp'
import { ok } from 'node:assert'
import { getContext } from '../context'

export async function embedOutboundMessages() {
  const context = getContext()
  ok(context.responseOutput, 'Response output not found')

  const lastOutbound = context.outbound[context.outbound.length - 1]
  ok(lastOutbound?.id, 'Last outbound message not found')

  const assistantText = extractText(context.responseOutput)

  if (!assistantText) {
    console.log('No text to embed for outbound message')
    return
  }

  const messagesWithText = new Map<string, string>()
  messagesWithText.set(lastOutbound.id, assistantText)

  console.log('Embedding outbound message')

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
  console.log(`Embedded outbound message: ${snippetInserts.length} chunks`)
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
