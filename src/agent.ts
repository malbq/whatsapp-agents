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
import { ASSISTANT_PRIORITY } from './utils/priorities'

export async function agent(deps: Deps, message: IncomingMessage): Promise<void> {
  const frame = new Frame()
  try {
    const messageEntity = await ReceiveMessageSystem(frame, deps, message)

    await UserSystem(frame, deps, {
      externalId: message.userExternalId,
      name: message.userName,
    })

    await IngestionSystem(frame, deps, messageEntity, message)

    await ResponseGenerationSystem(frame, deps, messageEntity)
    // ⤷ TODO: ToolExecutionSystem
    //   ⤷ TODO: SearchFileSystem
    //   ⤷ TODO: RetrieveFileSystem
    //   ⤷ TODO: CreateReminderSystem
    //   ⤷ TODO: CancelReminderSystem

    await ResponseDeliverySystem(frame, deps)

    ImproveUserProfileSystem(frame, deps, messageEntity)

    MediaStorageSystem(frame, deps, messageEntity)
    await EmbeddingSystem(frame, deps)
    await StoreMessageExchangeSystem(frame, deps)
  } catch (error) {
    console.error('Agent error:', error)

    // Check if there are any error components that need to be delivered
    const errorEntities = frame.query(['ErrorComponent'])
    if (errorEntities.length > 0) {
      // Convert error components to message entities for delivery
      for (const errorEntityId of errorEntities) {
        const errorComponent = frame.getComponent(errorEntityId, 'ErrorComponent')!
        const errorMessageEntity = frame.createEntity()
        frame.addComponent(errorMessageEntity, 'Message', {
          role: 'assistant',
          type: 'text',
          priority: ASSISTANT_PRIORITY,
        })
        frame.addComponent(errorMessageEntity, 'TextContent', { text: errorComponent.message })
      }
    } else {
      // Generic error message if no specific error component exists
      const errorMessageEntity = frame.createEntity()
      frame.addComponent(errorMessageEntity, 'Message', {
        role: 'assistant',
        type: 'text',
        priority: ASSISTANT_PRIORITY,
      })
      frame.addComponent(errorMessageEntity, 'TextContent', {
        text: 'Desculpe, tive algum problema ao tentar te responder.',
      })
    }

    // Always attempt delivery when we have a user
    try {
      await ResponseDeliverySystem(frame, deps)
    } catch (deliveryError) {
      console.error('Failed to deliver error response:', deliveryError)
    }
  } finally {
  }
}
