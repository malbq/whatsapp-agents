import { getLogger, withContext } from '@logtape/logtape'
import { Frame } from './agent/frame'
import { ImproveUserProfile } from './agent/systems/improveUserProfile'
import { IngestMessage } from './agent/systems/ingestMessage'
import { MediaStorage } from './agent/systems/mediaStorage'
import { MessageEmbedding } from './agent/systems/messageEmbedding'
import { PersistUser } from './agent/systems/persistUser'
import { ResponseDelivery } from './agent/systems/responseDelivery'
import { ResponseGeneration } from './agent/systems/responseGeneration'
import { StoreMessageExchange } from './agent/systems/storeMessageExchange'
import type { IncomingMessage } from './infra/chat'
import { spreadError } from './utils/spreadError'

const logger = getLogger(['app', 'agent'])

export async function agent(deps: Deps, message: IncomingMessage): Promise<void> {
  const frame = new Frame()

  await PersistUser(frame, deps, {
    externalId: message.userExternalId,
    name: message.userName,
  })
  if (!frame.user) {
    // Não podemos fazer nada sem um usuário, nem salvar a resposta no banco
    deps.chat.sendTextMessage({
      text: 'Desculpe, tive um problema e não consigo te responder agora.',
    })
    return
  }

  withContext({ userId: frame.user.id }, async () => {
    try {
      deps.chat.acknowledgeProcessingMessage(message.externalId)
      await IngestMessage(frame, deps, message)
      await MessageEmbedding(deps, frame.inbound)
      await ResponseGeneration(frame, deps)
    } catch (error) {
      logger.error('Error in agent response flow', { ...spreadError(error) })
      frame.outbound = {
        type: frame.inbound?.type ?? 'text',
        text: frame.inbound?.text ?? 'Desculpe, tive um problema ao processar sua mensagem.',
      }
    }

    try {
      await ResponseDelivery(frame, deps)
    } catch (error) {
      logger.error('Error in response delivery', { ...spreadError(error) })
      return
    }

    try {
      await Promise.all([MediaStorage(frame, deps), MessageEmbedding(deps, frame.outbound)])
      await StoreMessageExchange(frame, deps)
      ImproveUserProfile(frame, deps)
    } catch (error) {
      logger.error("Error after agent's response", { ...spreadError(error) })
    }
  })
}
