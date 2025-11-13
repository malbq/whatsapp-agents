import { getContext } from 'context'
import { ok } from 'node:assert'
//const logger = getLogger(['app', 'agent', 'storeMessageExchange'])

export async function storeMessageExchange(): Promise<void> {
  const context = getContext()
  ok(context.user, 'User not found')
  ok(context.inbound, 'Inbound message not found')
  ok(context.outbound.length, 'No outbound messages to store')

  const messagesToStore = [context.inbound, ...context.outbound]
  const messageIds = await context.db.storeMessage(messagesToStore)

  console.log(
    `Stored ${messageIds.length} messages (1 user, ${context.outbound.length} assistant)`,
    messagesToStore
  )
}
