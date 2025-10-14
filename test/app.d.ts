import type { AI } from '../src/infra/ai'
import type { Chat } from '../src/infra/chat'
import type { DB } from '../src/infra/db'
import type { Storage } from '../src/infra/storage'

declare global {
  interface ImportMetaEnv {
    PORT: string
    META_WEBHOOK_VERIFY_TOKEN: string
    META_API_TOKEN: string
    META_APP_SECRET: string
    WA_API_VERSION: string
    WA_BUSINESS_PHONE_ID: string
    CF_ACCOUNT_ID: string
    CF_GATEWAY_ID: string
    CF_API_TOKEN: string
    GOOGLE_AI_STUDIO_API_KEY: string
    GOOGLE_PLACES_API_KEY: string
    MAX_RECENT_MESSAGES: string
    VECTOR_DISTANCE_THRESHOLD: string
    FILE_SEARCH_LIMIT: string
    MAX_SIMILAR_MESSAGES: string
    REMINDER_SENDING_STALE_SECONDS: string
    NODE_ENV?: string
    TEST_AI?: string
  }
  interface TestDeps {
    chat: {
      parseNotification: jest.Mock<
        ReturnType<Chat['parseNotification']>,
        Parameters<Chat['parseNotification']>
      >
      acknowledgeMessage: jest.Mock<
        ReturnType<Chat['acknowledgeMessage']>,
        Parameters<Chat['acknowledgeMessage']>
      >
      sendText: jest.Mock<ReturnType<Chat['sendText']>, Parameters<Chat['sendText']>>
      sendImage: jest.Mock<ReturnType<Chat['sendImage']>, Parameters<Chat['sendImage']>>
      sendDocument: jest.Mock<ReturnType<Chat['sendDocument']>, Parameters<Chat['sendDocument']>>
      sendLocation: jest.Mock<ReturnType<Chat['sendLocation']>, Parameters<Chat['sendLocation']>>
      sendReaction: jest.Mock<ReturnType<Chat['sendReaction']>, Parameters<Chat['sendReaction']>>
      sendContact: jest.Mock<ReturnType<Chat['sendContact']>, Parameters<Chat['sendContact']>>
      sendInteractiveList: jest.Mock<
        ReturnType<Chat['sendInteractiveList']>,
        Parameters<Chat['sendInteractiveList']>
      >
      sendInteractiveButton: jest.Mock<
        ReturnType<Chat['sendInteractiveButton']>,
        Parameters<Chat['sendInteractiveButton']>
      >
      sendInteractiveCtaUrl: jest.Mock<
        ReturnType<Chat['sendInteractiveCtaUrl']>,
        Parameters<Chat['sendInteractiveCtaUrl']>
      >
      sendTemplate: jest.Mock<ReturnType<Chat['sendTemplate']>, Parameters<Chat['sendTemplate']>>
    }
    storage: {
      store: jest.Mock<ReturnType<Storage['store']>, Parameters<Storage['store']>>
      retrieve: jest.Mock<ReturnType<Storage['retrieve']>, Parameters<Storage['retrieve']>>
    }
    ai: {
      respond: jest.Mock<ReturnType<AI['respond']>, Parameters<AI['respond']>>
      transcribeAudio: jest.Mock<
        ReturnType<AI['transcribeAudio']>,
        Parameters<AI['transcribeAudio']>
      >
      analyzeImage: jest.Mock<ReturnType<AI['analyzeImage']>, Parameters<AI['analyzeImage']>>
      transcribeDocument: jest.Mock<
        ReturnType<AI['transcribeDocument']>,
        Parameters<AI['transcribeDocument']>
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
      updateProfileVersionMessageId: jest.Mock<
        ReturnType<DB['updateProfileVersionMessageId']>,
        Parameters<DB['updateProfileVersionMessageId']>
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
      searchFiles: jest.Mock<ReturnType<DB['searchFiles']>, Parameters<DB['searchFiles']>>
      findStorageKeyById: jest.Mock<
        ReturnType<DB['findStorageKeyById']>,
        Parameters<DB['findStorageKeyById']>
      >
      createReminder: jest.Mock<ReturnType<DB['createReminder']>, Parameters<DB['createReminder']>>
      cancelReminder: jest.Mock<ReturnType<DB['cancelReminder']>, Parameters<DB['cancelReminder']>>
      listUpcomingReminders: jest.Mock<
        ReturnType<DB['listUpcomingReminders']>,
        Parameters<DB['listUpcomingReminders']>
      >
      takeDueReminders: jest.Mock<
        ReturnType<DB['takeDueReminders']>,
        Parameters<DB['takeDueReminders']>
      >
      markReminderSent: jest.Mock<
        ReturnType<DB['markReminderSent']>,
        Parameters<DB['markReminderSent']>
      >
      markReminderFailed: jest.Mock<
        ReturnType<DB['markReminderFailed']>,
        Parameters<DB['markReminderFailed']>
      >
    }
  }
}

export {}
