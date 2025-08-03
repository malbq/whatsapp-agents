import { getLogger } from '@logtape/logtape'
import { Frame } from './agent/frame'
import { EmbeddingSystem } from './agent/systems/embeddingSystem'
import { ImproveUserProfileSystem } from './agent/systems/improveUserProfileSystem'
import { IngestionSystem } from './agent/systems/ingestionSystem'
import { MediaStorageSystem } from './agent/systems/mediaStorageSystem'
import { ReceiveMessageSystem } from './agent/systems/receiveMessageSystem'
import { ResponseDeliverySystem } from './agent/systems/responseDeliverySystem'
import { ResponseGenerationSystem } from './agent/systems/responseGenerationSystem'
import { StoreMessageExchangeSystem } from './agent/systems/storeMessageExchangeSystem'
import { UserSystem } from './agent/systems/userSystem'
import { IngestionError } from './errors'
import type { IncomingMessage } from './infra/chat'
import { ASSISTANT_PRIORITY } from './utils/priorities'
import { spreadError } from './utils/spreadError'

const logger = getLogger(['app', 'agent'])

export async function agent(deps: Deps, message: IncomingMessage): Promise<void> {
  const frame = new Frame()

  try {
    await UserSystem(frame, deps, {
      externalId: message.userExternalId,
      name: message.userName,
    })
  } catch (error) {
    logger.error('Error persisting user', { ...spreadError(error) })
    // we can't do anything without a user
    return
  }

  const messageEntity = ReceiveMessageSystem(frame, message)
  try {
    await IngestionSystem(frame, deps, messageEntity, message)
    deps.chat.acknowledgeProcessingMessage(message.externalId)
    await ResponseGenerationSystem(frame, deps, messageEntity)
    // ⤷ TODO: ToolExecutionSystem
    //   ⤷ TODO: SearchFileSystem
    //   ⤷ TODO: RetrieveFileSystem
    //   ⤷ TODO: CreateReminderSystem
    //   ⤷ TODO: CancelReminderSystem
  } catch (error) {
    logger.error('Ingestion error', { ...spreadError(error) })
    const errorMessageEntity = frame.createEntity()
    frame.addComponent(errorMessageEntity, 'Message', {
      role: 'assistant',
      type: 'text',
      priority: ASSISTANT_PRIORITY,
    })
    frame.addComponent(errorMessageEntity, 'TextContent', {
      text:
        error instanceof IngestionError
          ? error.message
          : 'Desculpe, tive um problema ao processar sua mensagem.',
    })
  }
  await ResponseDeliverySystem(frame, deps)

  try {
    await Promise.all([
      MediaStorageSystem(frame, deps, messageEntity),
      EmbeddingSystem(frame, deps),
    ])
    await StoreMessageExchangeSystem(frame, deps)
    ImproveUserProfileSystem(frame, deps, messageEntity)
  } catch (error) {
    logger.error("Error after agent's response", { ...spreadError(error) })
  }
}
