import { createRecordingChat } from '@wa/core/testing'
import type { MessageNotification } from '@wa/whatsapp'
import { describe, expect, test } from 'bun:test'
import { createCommandHandler } from './handler'
import { helpText } from './lib/command'

function textNotification(text: string): MessageNotification {
  return {
    userWaId: '15550001234',
    userName: 'Test User',
    userPhone: '15550001234',
    timestamp: new Date(),
    message: { type: 'text', messageWaId: 'wamid.in.1', text },
  }
}

describe('cmd command handler', () => {
  test.each([
    ['/help', 'sendText'],
    ['/text', 'sendText'],
    ['/contact', 'sendContact'],
    ['/location', 'sendLocation'],
    ['/list', 'sendInteractiveList'],
    ['/button', 'sendInteractiveButton'],
    ['/cta', 'sendInteractiveCtaUrl'],
  ])('%s sends a message with %s', async (command, method) => {
    const chat = createRecordingChat()
    await createCommandHandler(chat)(textNotification(command))
    expect(chat.sent).toMatchObject([{ method, userId: '15550001234' }])
  })

  test('/help lists the commands', async () => {
    const chat = createRecordingChat()
    await createCommandHandler(chat)(textNotification('/help'))
    expect(chat.sent[0]?.message).toEqual({ text: helpText })
  })

  test('replies to unknown commands', async () => {
    const chat = createRecordingChat()
    await createCommandHandler(chat)(textNotification('/nope'))
    expect(chat.sent).toMatchObject([
      { method: 'sendText', message: { text: expect.stringContaining('Unknown command: /nope') } },
    ])
  })

  test('ignores plain text', async () => {
    const chat = createRecordingChat()
    await createCommandHandler(chat)(textNotification('hello'))
    expect(chat.sent).toEqual([])
  })
})
