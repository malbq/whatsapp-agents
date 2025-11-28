/*
Key concepts
  - Context: per-request state holder kept in AsyncLocalStorage.
  - Systems: small functions that read/write the Context and use its injected deps (db, storage, chat, webSearch).
  - ResponseGeneration assembles system prompt, user profile, recent messages, tools, and current input.
  - Delivery (WhatsApp send + outbound DB message) happens inside responseGeneration; storage, logging, and embeddings run in separate systems.

Agent Workflow
  User -[send message]-> Ingest (persists + embeds)
    - if message is a reaction: skip ingest and agent
    - if message is flow_reply: skip ingest, check consent
  Ingest: persist message to DB with correct timestamp
  Ingest: embed message for semantic search
  ConsentCheck: if not consented, send onboarding template and stop
  Agent: retrieve recent messages from DB (inbound is at tail)
  Agent -[generate response]-> AI Provider
  - tools may be called:
    - search_conversation_history
    - search_files
    - send_text: Server -[text message]-> User
    - web_search
    - web_fetch
    - google_places: Server -[location/contact message]-> User
    - send_reaction: Server -[reaction message]-> User
    - update_user_profile
  AI Provider -[answer]-> Agent
  Agent -[send message]-> User
  Post-response:
    Agent: store outbound messages
    Agent: update user profile if improved
    Agent: embed outbound messages

Error segmentation
  - Response flow: on failure, log and send a polite fallback; continue.
  - Post-tasks: best-effort; failures are logged and do not affect the user.
*/
import { toDbMessage } from '@batman/core/utils/toDbMessage'
import { toAssistantModelMessage } from '@batman/core/utils/toModelMessage'
import type { TextMessage } from '@batman/whatsapp'
import { ok } from 'node:assert'
import { getContext } from './context'
import { embedOutboundMessages } from './systems/embedOutboundMessages'
import { recordUsage } from './systems/entitlements'
import { responseGeneration } from './systems/responseGeneration'
import { storeAgentResponse } from './systems/storeAgentResponse'

export async function agent(): Promise<void> {
  const context = getContext()
  const { userWaId } = context.notification

  ok(context.user, 'User not found')

  console.log('Starting agent response flow', { userId: context.user.id })

  try {
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
    await storeAgentResponse()
    await embedOutboundMessages()
    await recordUsage('n_messages_per_day', 1)
  } catch (error) {
    console.error("Error after agent's response", error)
  }
}
