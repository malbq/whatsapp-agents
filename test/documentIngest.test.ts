import { afterEach, beforeAll, beforeEach, describe, expect, jest, mock, test } from 'bun:test'
import { Frame } from '../packages/agent/default/frame'
import { ingestDocument } from '../packages/core/systems/ingestDocument'
import { parsePdf } from '../packages/core/utils/parsePdf'

let deps: TestDeps
let frame: Frame

const mockDocumentTranscription = 'This is a test document transcription'
const parsePdfMock = mock(parsePdf)

beforeAll(async () => {
  mock.module('../packages/core/utils/parsePdf', () => ({
    parsePdf: parsePdfMock,
  }))
  deps = {
    db: {
      findRecentMessages: mock(),
      persistUser: mock(),
      updateUserProfile: mock(),
      updateProfileVersionMessageId: mock(),
      storeMessage: mock(),
      storeWebhookEvent: mock(),
      findSimilarMessages: mock(),
      searchFiles: mock(),
      findStorageKeyById: mock(),
      createReminder: mock(),
      cancelReminder: mock(),
      listUpcomingReminders: mock(),
      takeDueReminders: mock(),
      markReminderSent: mock(),
      markReminderFailed: mock(),
    },
    chat: {
      parseNotification: mock(),
      acknowledgeMessage: mock(),
      sendText: mock(),
      sendImage: mock(),
      sendDocument: mock(),
      sendLocation: mock(),
      sendReaction: mock(),
      sendContact: mock(),
      sendInteractiveList: mock(),
      sendInteractiveButton: mock(),
      sendInteractiveCtaUrl: mock(),
      sendTemplate: mock(),
    },
    ai: {
      analyzeImage: mock(),
      respond: mock(),
      transcribeAudio: mock(),
      transcribeDocument: mock(async () => mockDocumentTranscription),
      generateEmbeddings: mock(),
    },
    storage: {
      store: mock(),
      retrieve: mock(),
    },
  }
})

beforeEach(async () => {
  frame = new Frame()
})

afterEach(async () => {
  jest.clearAllMocks()
})

describe('Document ingest', () => {
  test('should process transcribeDocument.input.pdf file successfully', async () => {
    const pdfBuffer = new ArrayBuffer(1024)

    frame.inbound = {
      type: 'document',
      media: {
        data: pdfBuffer,
        mimeType: 'application/pdf',
        filename: 'transcribeDocument.input.pdf',
      },
    }

    await ingestDocument(frame, deps)

    expect(parsePdfMock).toHaveBeenCalledWith(pdfBuffer)
    expect(frame.inbound?.media?.transcription).toBeDefined()
  })

  test('should process transcribeDocument_flat.input.pdf file successfully', async () => {
    const pdfBuffer = new ArrayBuffer(1024)

    frame.inbound = {
      type: 'document',
      media: {
        data: pdfBuffer,
        mimeType: 'application/pdf',
        filename: 'transcribeDocument_flat.input.pdf',
      },
    }

    parsePdfMock.mockResolvedValueOnce('')

    await ingestDocument(frame, deps)

    expect(parsePdfMock).toHaveBeenCalledWith(pdfBuffer)
    expect(frame.inbound?.media?.transcription).toBe(mockDocumentTranscription)
  })

  test('should throw error when media is missing', async () => {
    frame.inbound = {
      type: 'document',
    }

    await expect(ingestDocument(frame, deps)).rejects.toThrow(
      'Media is required for document ingestion'
    )
  })

  test('should throw error when filename is missing', async () => {
    const pdfBuffer = new ArrayBuffer(1024)

    frame.inbound = {
      type: 'document',
      media: {
        data: pdfBuffer,
        mimeType: 'application/pdf',
      },
    }

    await expect(ingestDocument(frame, deps)).rejects.toThrow(
      'Filename is required for document ingestion'
    )
  })
})
