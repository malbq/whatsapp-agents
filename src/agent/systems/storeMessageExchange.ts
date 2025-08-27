import { getLogger } from '@logtape/logtape'
import type { DbMessageInput, MessageRole } from '../../infra/db'
import type { Frame, FrameMessage } from '../frame'

const logger = getLogger(['app', 'agent', 'storeMessageExchange'])

export async function StoreMessageExchange(frame: Frame, deps: Deps): Promise<void> {
  if (!frame.user || !frame.inbound || !frame.outbound) return

  const messageIds = await deps.db.storeMessage([
    mapMessageToDb(frame.inbound, frame.user.id, 'user'),
    ...frame.systemMessages.map((msg) => mapMessageToDb(msg, frame.user!.id, 'system')),
    mapMessageToDb(frame.outbound, frame.user.id, 'assistant'),
  ])

  frame.inbound.id = messageIds[0]

  logger.info(`Stored ${messageIds.length} messages`)
}

function mapMessageToDb(message: FrameMessage, userId: string, role: MessageRole): DbMessageInput {
  return {
    userId,
    role,
    externalId: message.externalId,
    type: message.type,
    content: message.embeddedContent ?? [
      {
        content: message.text ?? '',
        embedding: [],
      },
    ],
    storageKey: message.media?.storageKey,
  }
}
