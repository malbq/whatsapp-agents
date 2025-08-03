import { afterEach, beforeAll, beforeEach, describe, expect, jest, mock, test } from 'bun:test'
import { join } from 'node:path'
import { Frame } from '../src/agent/frame'
import { documentIngest } from '../src/agent/systems/documentIngest'
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
    },
    chat: {
      parseNotification: mock(),
      acknowledgeProcessingMessage: mock(),
      sendTextMessage: mock(),
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
  test('should process bun.pdf file successfully', async () => {
    const messageEntity = frame.createEntity()
    const pdfBuffer = await Bun.file(join(import.meta.dir, 'bun.pdf')).arrayBuffer()

    frame.addComponent(messageEntity, 'Media', {
      data: pdfBuffer,
      mimeType: 'application/pdf',
    })

    await documentIngest(frame, deps, messageEntity, 'bun.pdf')

    expect(parsePdfMock).toHaveBeenCalledWith(pdfBuffer)
    expect(deps.ai.transcribeDocument).not.toHaveBeenCalled()

    const systemMessageEntity = frame
      .query(['Message'])
      .find((entity: number) => frame.getComponent(entity, 'Message')?.role === 'system')
    expect(systemMessageEntity).toBeDefined()

    const textContent = frame.getComponent(systemMessageEntity!, 'TextContent')
    expect(textContent!.text).toContain('bun.pdf')
  })

  test('should process bun_flat.pdf file successfully', async () => {
    const messageEntity = frame.createEntity()
    const pdfBuffer = await Bun.file(join(import.meta.dir, 'bun_flat.pdf')).arrayBuffer()

    frame.addComponent(messageEntity, 'Media', {
      data: pdfBuffer,
      mimeType: 'application/pdf',
    })

    await documentIngest(frame, deps, messageEntity, 'bun_flat.pdf')

    expect(parsePdfMock).toHaveBeenCalledWith(pdfBuffer)
    expect(deps.ai.transcribeDocument).toHaveBeenCalledWith({
      document: pdfBuffer,
      mimeType: 'application/pdf',
      filename: 'bun_flat.pdf',
    })

    const systemMessageEntity = frame
      .query(['Message'])
      .find((entity: number) => frame.getComponent(entity, 'Message')?.role === 'system')
    expect(systemMessageEntity).toBeDefined()

    const textContent = frame.getComponent(systemMessageEntity!, 'TextContent')
    expect(textContent).toBeDefined()
    expect(textContent!.text).toContain('bun_flat.pdf')
  })
})
