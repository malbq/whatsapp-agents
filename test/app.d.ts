import type { AI } from '../src/infra/ai'
import type { Chat } from '../src/infra/chat'
import type { DB } from '../src/infra/db'
import type { Storage } from '../src/infra/storage'

declare global {
  interface TestDeps {
    chat: {
      parseNotification: jest.Mock<
        ReturnType<Chat['parseNotification']>,
        Parameters<Chat['parseNotification']>
      >
      acknowledgeProcessingMessage: jest.Mock<
        ReturnType<Chat['acknowledgeProcessingMessage']>,
        Parameters<Chat['acknowledgeProcessingMessage']>
      >
      sendTextMessage: jest.Mock<
        ReturnType<Chat['sendTextMessage']>,
        Parameters<Chat['sendTextMessage']>
      >
    }
    storage: {
      store: jest.Mock<ReturnType<Storage['store']>, Parameters<Storage['store']>>
      retrieve: jest.Mock<ReturnType<Storage['retrieve']>, Parameters<Storage['retrieve']>>
    }
    ai: {
      analyzeImage: jest.Mock<ReturnType<AI['analyzeImage']>, Parameters<AI['analyzeImage']>>
      respond: jest.Mock<ReturnType<AI['respond']>, Parameters<AI['respond']>>
      transcribeAudio: jest.Mock<
        ReturnType<AI['transcribeAudio']>,
        Parameters<AI['transcribeAudio']>
      >
      transcribeDocument: jest.Mock<
        ReturnType<AI['transcribeDocument']>,
        Parameters<AI['transcribeDocument']>
      >
      improveUserProfile: jest.Mock<
        ReturnType<AI['improveUserProfile']>,
        Parameters<AI['improveUserProfile']>
      >
      generateEmbeddings: jest.Mock<
        ReturnType<AI['generateEmbeddings']>,
        Parameters<AI['generateEmbeddings']>
      >
    }
    db: {
      findRecentMessages: jest.Mock<
        ReturnType<DB['findRecentMessages']>,
        Parameters<DB['findRecentMessages']>
      >
      persistUser: jest.Mock<ReturnType<DB['persistUser']>, Parameters<DB['persistUser']>>
      updateUserProfile: jest.Mock<
        ReturnType<DB['updateUserProfile']>,
        Parameters<DB['updateUserProfile']>
      >
      storeMessage: jest.Mock<ReturnType<DB['storeMessage']>, Parameters<DB['storeMessage']>>
      storeWebhookEvent: jest.Mock<
        ReturnType<DB['storeWebhookEvent']>,
        Parameters<DB['storeWebhookEvent']>
      >
      findSimilarMessages: jest.Mock<
        ReturnType<DB['findSimilarMessages']>,
        Parameters<DB['findSimilarMessages']>
      >
    }
  }
}

export {}
