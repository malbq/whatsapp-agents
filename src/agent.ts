import { getLogger, withContext } from '@logtape/logtape'
import { Frame } from './agent/frame'
import { embedMessages } from './agent/systems/embedMessages'
import { ingestMessage } from './agent/systems/ingestMessage'
import { persistUser } from './agent/systems/persistUser'
import { responseGeneration } from './agent/systems/responseGeneration'
import { storeMedia } from './agent/systems/storeMedia'
import { storeMessageExchange } from './agent/systems/storeMessageExchange'
import { updateProfileVersionMessageId } from './agent/systems/updateProfileVersionMessageId'
import type { IncomingMessage } from './infra/chat'
import { spreadError } from './utils/spreadError'

const logger = getLogger(['app', 'agent'])

export async function agent(deps: Deps, message: IncomingMessage): Promise<void> {
  const frame = new Frame()

  await persistUser(frame, deps, {
    externalId: message.userExternalId,
    name: message.userName,
  })

  if (!frame.user) {
    // Não podemos fazer nada sem um usuário, nem salvar a resposta no banco
    logger.error('User not found')
    deps.chat.sendText({ text: 'Desculpe, tive um problema e não consigo te responder agora.' })
    return
  }

  await withContext({ userId: frame.user.id }, async () => {
    deps.chat.acknowledgeMessage(message.externalId)
    try {
      await ingestMessage(frame, deps, message)
      await responseGeneration(frame, deps)
    } catch (error) {
      logger.error(`Agent response flow error: ${String(error)}`, { ...spreadError(error) })
      frame.outbound = frame.outbound ?? {
        type: 'text',
        text: 'Desculpe, tive um problema ao processar sua mensagem.',
      }
      deps.chat.sendText({ text: frame.outbound.text! })
    }

    try {
      await Promise.all([storeMedia(frame, deps), embedMessages(frame, deps)])
      await storeMessageExchange(frame, deps)
      await updateProfileVersionMessageId(frame, deps)
    } catch (error) {
      logger.error(`Error after agent's response: ${String(error)}`, { ...spreadError(error) })
    }
  })
}
