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
import { toDbMessage } from '@batman/core/utils/toDbMessage'
import { toAssistantModelMessage, toUserModelMessage } from '@batman/core/utils/toModelMessage'
import type { TextMessage } from '@batman/whatsapp'
import { ok } from 'node:assert'
import { getContext } from './context'
import { persistUser } from './systems/persistUser'
import { responseGeneration } from './systems/responseGeneration'
import { storeMessageExchange } from './systems/storeMessageExchange'

export async function agent(): Promise<void> {
  const context = getContext()
  const { message, userWaId, userName } = context.notification
  if (message.type === 'reaction') {
    console.log('Reaction message, skipping agent response flow', { message })
    return
  }

  console.log('Starting agent response flow', { message })

  context.chat.acknowledgeMessage(message.messageWaId)

  try {
    await persistUser({ userName, userWaId })
  } catch (error) {
    // Não podemos fazer nada sem um usuário, nem salvar a resposta no banco
    console.error(`Error persisting user: ${userName} (${userWaId})`, error)
    context.chat.sendText(userWaId, {
      // FIXME: what language should we use here? infer with llm?
      text: 'Desculpe, tive um problema e não consigo te responder agora.',
    })
    return
  }

  ok(context.user, 'User not found')

  try {
    const userModelMessage = await toUserModelMessage(message)
    context.inbound = toDbMessage({
      userId: context.user.id,
      notification: context.notification,
      modelMessage: userModelMessage,
    })
    context.chat.sendTypingIndicator(message.messageWaId)
    await responseGeneration()
  } catch (error) {
    console.error('Agent response flow error', error)
    const errorMessage: TextMessage = {
      type: 'text',
      text: 'Desculpe, tive um problema ao processar sua mensagem.',
    }
    const errorMessageId = await context.chat.sendText(userWaId, errorMessage)
    context.outbound = [
      toDbMessage({
        userId: context.user.id,
        waId: errorMessageId,
        modelMessage: toAssistantModelMessage(errorMessage),
      }),
    ]
  }

  try {
    // await embedMessages(frame, deps)
    await storeMessageExchange()
  } catch (error) {
    console.error("Error after agent's response", error)
  }
}
