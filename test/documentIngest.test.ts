import { afterEach, beforeAll, beforeEach, describe, expect, jest, mock, test } from 'bun:test'
import { join } from 'node:path'
import { Frame } from '../src/agent/frame'
import { ingestDocument } from '../src/agent/systems/ingestDocument'
import { parsePdf } from '../src/utils/parsePdf'

let deps: TestDeps
let frame: Frame

const mockDocumentTranscription = 'This is a test document transcription'
const parsePdfMock = mock(parsePdf)

beforeAll(async () => {
  mock.module('../src/utils/parsePdf', () => ({
    parsePdf: parsePdfMock,
  }))
  deps = {
    db: {
      findRecentMessages: mock(),
      persistUser: mock(),
      updateUserProfile: mock(),
      storeMessage: mock(),
      storeWebhookEvent: mock(),
      findSimilarMessages: mock(),
      searchFiles: mock(),
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
    },
    ai: {
      analyzeImage: mock(),
      respond: mock(),
      transcribeAudio: mock(),
      transcribeDocument: mock(async () => mockDocumentTranscription),
      improveUserProfile: mock(),
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
    const pdfBuffer = await Bun.file(
      join(import.meta.dir, '../eval/transcribeDocument.input.pdf')
    ).arrayBuffer()

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
    const pdfBuffer = await Bun.file(
      join(import.meta.dir, '../eval/transcribeDocument_flat.input.pdf')
    ).arrayBuffer()

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
    const pdfBuffer = await Bun.file(
      join(import.meta.dir, '../eval/transcribeDocument.input.pdf')
    ).arrayBuffer()

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
