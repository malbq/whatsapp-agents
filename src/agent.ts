import type { Message, TextMessage } from './domain/message'
import type { Reminder } from './domain/schedule'
import type { User, UserProfile } from './domain/user'
import type { VectorMemory } from './domain/vectorMemory'
import { generateResponse } from './features/generateResponse'
import { transcribeAudioMessage } from './features/transcribeAudioMessage'

//TODO: user e userMessage podem estar em AsyncLocalStorage
// inicializado no endpoint /webhook
type AgentContext = {
  userMessage: Message
  user: User
  userProfile: UserProfile
  vectorSearchResults: Array<VectorMemory>
  recentMessages: Array<Message>
  scheduledReminders: Array<Reminder>
  agentActions: {
    createReminder: any
    cancelReminder: any
    retrieveFile: any
  }
  agentMessage: Message
}

type S1_Context = Pick<AgentContext, 'userMessage' | 'user'>
type S2_Context = S1_Context
type S3_Context = S2_Context &
  Pick<
    AgentContext,
    'vectorSearchResults' | 'recentMessages' | 'scheduledReminders'
  >
type S4_Context = S3_Context & Pick<AgentContext, 'agentActions'>

// TODO: handle different response types
export async function agent(
  deps: Deps,
  step1context: S1_Context
): Promise<TextMessage> {
  // 1. Message Ingestion
  // 1.1. Process Audio Message
  if (
    step1context.userMessage.type === 'audio' ||
    step1context.userMessage.type === 'voice'
  ) {
    try {
      step1context.userMessage = await transcribeAudioMessage(
        deps,
        step1context.userMessage
      )
    } catch {
      return {
        role: 'agent',
        type: 'text',
        from: step1context.userMessage.to,
        to: step1context.userMessage.from,
        body: 'Desculpe, não consegui transcrever este áudio.',
      }
    }
  }
  // 1.2. Process Image Message
  // 1.3. Process Document Message
  // 1.4. Store Embeddings
  // 1.5. Update User Profile

  // 2. Prompt Preparation and Context Orchestration
  // 2.1. assembleContext
  // 2.1.1. loadUserProfile
  // 2.1.2. loadRecentMessages
  // 2.1.3. loadScheduledReminders
  // 2.1.4. vectorSearch
  // 2.1.4.1. include metadata to potentially retrieve file (doc or image)
  // 2.2. buildSystemPrompt

  // 3. Tool Integration
  // 3.1. executeReminderTools
  // 3.2. executeFileRetrievalTools
  // 4. Response Delivery
  // 4.1. integrateToolResults
  // 4.2. prepareFinalResponse
  // 4.3. sendResponse
  // 4.4. storeAssistantResponse

  if (step1context.userMessage.type === 'text') {
    const response = await generateResponse(deps, step1context.userMessage.body)
    return {
      role: 'agent',
      type: 'text',
      from: step1context.userMessage.to,
      to: step1context.userMessage.from,
      body: response,
    }
  }

  return {
    role: 'agent',
    type: 'text',
    from: step1context.userMessage.to,
    to: step1context.userMessage.from,
    body: 'Desculpe, não consigo responder a esta mensagem.',
  }
}
