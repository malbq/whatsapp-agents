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
import type { IncomingMessage } from './infra/chat'

export async function agent(deps: Deps, message: IncomingMessage): Promise<void> {
  const frame = new Frame()
  const messageEntity = await ReceiveMessageSystem(frame, deps, message)
  await UserSystem(frame, deps, {
    externalId: message.userExternalId,
    name: message.userName,
  })
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
    console.error('Agent error:', error)
  }
  await ResponseDeliverySystem(frame, deps)
  ImproveUserProfileSystem(frame, deps, messageEntity)
  MediaStorageSystem(frame, deps, messageEntity)
  await EmbeddingSystem(frame, deps)
  StoreMessageExchangeSystem(frame, deps)
}
