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
import { spreadError } from '@batman/core/utils/spreadError'
import { toAssistantModelMessage, toUserModelMessage } from '@batman/core/utils/toModelMessage'
import type { TextMessage } from '@batman/whatsapp'
import { getContext } from './context'
import { Frame } from './frame'
import { embedMessages } from './systems/embedMessages'
import { persistUser } from './systems/persistUser'
import { responseGeneration } from './systems/responseGeneration'
import { storeMedia } from './systems/storeMedia'
import { storeMessageExchange } from './systems/storeMessageExchange'
import { updateProfileVersionMessageId } from './systems/updateProfileVersionMessageId'
import type { Deps } from './types'

export async function agent(deps: Deps): Promise<void> {
  const { message, userId, userName } = getContext()
  console.log('Starting agent response flow', { message })
  const frame = new Frame()

  deps.chat.acknowledgeMessage(message.messageId)

  await persistUser(frame, deps, {
    userName: userName,
    userExternalId: userId,
  })

  if (!frame.user) {
    // Não podemos fazer nada sem um usuário, nem salvar a resposta no banco
    console.error('User not found')
    deps.chat.sendText(userId, {
      text: 'Desculpe, tive um problema e não consigo te responder agora.',
    })
    return
  }

  deps.chat.sendTypingIndicator(message.messageId)

  try {
    frame.inbound = await toUserModelMessage(message)
    await responseGeneration(frame, deps)
  } catch (error) {
    console.error(`Agent response flow error: ${String(error)}`, { ...spreadError(error) })
    const errorMessage: TextMessage = {
      type: 'text',
      text: 'Desculpe, tive um problema ao processar sua mensagem.',
    }
    deps.chat.sendText(userId, errorMessage)
    frame.outbound.push(toAssistantModelMessage(errorMessage))
  }

  try {
    await Promise.all([storeMedia(frame, deps), embedMessages(frame, deps)])
    await storeMessageExchange(frame, deps)
    await updateProfileVersionMessageId(frame, deps)
  } catch (error) {
    console.error(`Error after agent's response: ${String(error)}`, { ...spreadError(error) })
  }
}
