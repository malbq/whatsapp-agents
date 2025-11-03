/*
Key concepts
  - Frame: per-request state holder.
  - Systems: small functions that read/write the Frame and use injected deps.
  - ResponseGeneration assembles system prompt, profile, recent messages, and current input.
  - Delivery happens inside responseGeneration.

Agent Workflow
  User -[send message]-> Agent
  Agent: create Frame
  Agent: persistUser
    - if missing user: Agent -[Fallback]-> User (abort)
  Agent -[send "status read" and "typing indicator"]-> User
  Agent: ingestMessage
    - text
    - voice
    - audio
    - image
    - document
  Agent -[generate response]-> AI Provider
  - tools may be called:
    - fetch_memory
    - search_files
    - send_file: Server -[media message]-> User
    - web_search
    - web_fetch
    - google_places: Server -[location/contact message]-> User
    - send_reaction: Server -[reaction message]-> User
    - update_user_profile
  AI Provider -[text answer]-> Agent
  Agent -[send text message]-> User
  Post-response:
    Agent: store media (document/image) + embed messages
    Agent: store message exchange
    Agent: add user's message id to updated profile version

Error segmentation
  - Response flow: on failure, log and send a polite fallback; continue.
  - Post-tasks: best-effort; failures are logged and do not affect the user.
*/
import { Frame } from './frame'
import { embedMessages } from './systems/embedMessages'
import { ingestMessage } from './systems/ingestMessage'
import { persistUser } from './systems/persistUser'
import { responseGeneration } from './systems/responseGeneration'
import { storeMedia } from './systems/storeMedia'
import { storeMessageExchange } from './systems/storeMessageExchange'
import { updateProfileVersionMessageId } from './systems/updateProfileVersionMessageId'
import { spreadError } from '../../core/utils/spreadError'
import type { Deps, IncomingMessage } from './types'

export type { Deps, IncomingMessage }

export async function agent(deps: Deps, message: IncomingMessage): Promise<void> {
  console.log('Starting agent response flow', { message })
  const frame = new Frame()

  await persistUser(frame, deps, {
    userName: message.userName,
    userExternalId: message.userExternalId,
  })

  if (!frame.user) {
    // Não podemos fazer nada sem um usuário, nem salvar a resposta no banco
    console.error('User not found')
    deps.chat.sendText({ text: 'Desculpe, tive um problema e não consigo te responder agora.' })
    return
  }

  // await withContext(
  //   { userId: frame.user.id, userName: frame.user.name, userExternalId: frame.user.externalId },
  //   async () => {
  deps.chat.acknowledgeMessage(message.externalId)
  try {
    await ingestMessage(frame, deps, message)
    await responseGeneration(frame, deps)
  } catch (error) {
    console.error(`Agent response flow error: ${String(error)}`, { ...spreadError(error) })
    if (frame.outboundMessages.length === 0) {
      const errorText = 'Desculpe, tive um problema ao processar sua mensagem.'
      deps.chat.sendText({ text: errorText })
      frame.outboundMessages.push({
        type: 'text',
        text: errorText,
      })
    }
  }

  try {
    await Promise.all([storeMedia(frame, deps), embedMessages(frame, deps)])
    await storeMessageExchange(frame, deps)
    await updateProfileVersionMessageId(frame, deps)
  } catch (error) {
    console.error(`Error after agent's response: ${String(error)}`, { ...spreadError(error) })
  }
  // }
  // )
}
