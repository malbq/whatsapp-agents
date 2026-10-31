import { Link, useLoaderData } from '@tanstack/react-router'
import type {
  AssistantModelMessage,
  FilePart,
  ImagePart,
  TextPart,
  ToolCallPart,
  ToolModelMessage,
  ToolResultPart,
  UserModelMessage,
} from 'ai'

type ModelMessage = AssistantModelMessage | ToolModelMessage | UserModelMessage

export type ChatThread = {
  userId: string
  userName: string
  externalId: string
  messages: Array<{
    id: string
    role: string
    messages: ModelMessage[]
    timestamp: string
  }>
}

interface ParsedMessage {
  label: string
  content: string
  bubbleClass: 'user' | 'assistant' | 'tool' | 'tool-call'
  toolData?: string
}

function formatToolResultOutput(output: ToolResultPart['output']): string {
  // ToolResultOutput is { type: 'text', value: string }
  if (output.type === 'text') {
    return output.value
  }
  return JSON.stringify(output, null, 2)
}

function formatToolCallInput(input: ToolCallPart['input']): string {
  if (input === undefined || input === null) {
    return '(no input)'
  }
  return JSON.stringify(input, null, 2)
}

// WhatsApp message structure as stored in DB
interface WhatsAppTextMessage {
  type: 'text'
  text: string
}

interface WhatsAppLocationMessage {
  type: 'location'
  name?: string
  address?: string
  latitude: number
  longitude: number
}

interface WhatsAppContactMessage {
  type: 'contact'
  name: string
  phone: string
}

interface WhatsAppDocumentMessage {
  type: 'document'
  resourceId: string
  caption?: string
}

interface WhatsAppImageMessage {
  type: 'image'
  resourceId: string
  caption?: string
}

interface WhatsAppInteractiveButtonMessage {
  type: 'interactive_button'
  body: string
  buttons?: string[]
}

interface WhatsAppInteractiveListMessage {
  type: 'interactive_list'
  body: string
  sections?: Array<{ options?: Array<{ title: string }> }>
}

type WhatsAppMessage =
  | WhatsAppTextMessage
  | WhatsAppLocationMessage
  | WhatsAppContactMessage
  | WhatsAppDocumentMessage
  | WhatsAppImageMessage
  | WhatsAppInteractiveButtonMessage
  | WhatsAppInteractiveListMessage

interface WhatsAppOutputWrapper {
  message?: WhatsAppMessage
}

function parseWhatsAppOutput(text: string): string {
  try {
    const parsed = JSON.parse(text) as WhatsAppOutputWrapper | WhatsAppMessage
    const message: WhatsAppMessage | undefined =
      'message' in parsed ? parsed.message : (parsed as WhatsAppMessage)

    if (!message || !('type' in message)) {
      return text
    }

    switch (message.type) {
      case 'text':
        return message.text
      case 'location':
        return `📍 Location: ${message.name ?? ''} ${message.address ?? ''}\n(${
          message.latitude
        }, ${message.longitude})`
      case 'contact':
        return `👤 Contact: ${message.name}\n📞 ${message.phone}`
      case 'document':
        return `📄 Document: ${message.resourceId}${message.caption ? `\n${message.caption}` : ''}`
      case 'image':
        return `🖼️ Image: ${message.resourceId}${message.caption ? `\n${message.caption}` : ''}`
      case 'interactive_button': {
        const buttons = message.buttons
        return `${message.body}\n\nButtons: [${buttons?.join('] [')}]`
      }
      case 'interactive_list': {
        const sections = message.sections
        const options = sections?.flatMap((s) => s.options?.map((o) => o.title) ?? []) ?? []
        return `${message.body}\n\nOptions: ${options.join(', ')}`
      }
      default:
        return text
    }
  } catch {
    return text
  }
}

type UserContentPart = TextPart | ImagePart | FilePart
type AssistantContentPart = TextPart | ToolCallPart

function parseModelMessage(msg: ModelMessage): ParsedMessage[] {
  const results: ParsedMessage[] = []

  if (msg.role === 'tool') {
    const toolMessage = msg as ToolModelMessage
    const toolResults = toolMessage.content.filter(
      (p): p is ToolResultPart => p.type === 'tool-result'
    )
    if (toolResults.length > 0) {
      const first = toolResults[0]
      if (first) {
        const toolName = first.toolName
        const output = toolResults.map((r) => formatToolResultOutput(r.output)).join('\n')
        results.push({
          label: `TOOL RESULT: ${toolName}`,
          content: '',
          bubbleClass: 'tool',
          toolData: output,
        })
      }
      return results
    }
  }

  if (msg.role === 'assistant') {
    const assistantMessage = msg as AssistantModelMessage
    if (typeof assistantMessage.content === 'string') {
      const content = parseWhatsAppOutput(assistantMessage.content)
      results.push({
        label: 'ASSISTANT',
        content,
        bubbleClass: 'assistant',
      })
      return results
    }

    const contentParts = assistantMessage.content as AssistantContentPart[]
    const toolCalls = contentParts.filter((p): p is ToolCallPart => p.type === 'tool-call')
    if (toolCalls.length > 0) {
      const first = toolCalls[0]
      if (first) {
        const toolName = first.toolName
        const input = formatToolCallInput(first.input)
        results.push({
          label: `TOOL CALL: ${toolName}`,
          content: '',
          bubbleClass: 'tool-call',
          toolData: input,
        })
      }
      return results
    }

    const textParts = contentParts.filter((p): p is TextPart => p.type === 'text')
    if (textParts.length > 0) {
      const text = textParts.map((p) => p.text).join('\n')
      const content = parseWhatsAppOutput(text)
      results.push({
        label: 'ASSISTANT',
        content,
        bubbleClass: 'assistant',
      })
      return results
    }
  }

  if (msg.role === 'user') {
    const userMessage = msg as UserModelMessage
    if (typeof userMessage.content === 'string') {
      results.push({
        label: 'USER',
        content: userMessage.content,
        bubbleClass: 'user',
      })
      return results
    }

    const contentParts = userMessage.content as UserContentPart[]
    const textParts: string[] = []
    for (const part of contentParts) {
      if (part.type === 'text') {
        textParts.push(part.text)
      } else if (part.type === 'file') {
        textParts.push('[File]')
      } else if (part.type === 'image') {
        textParts.push('[Image]')
      }
    }
    results.push({
      label: 'USER',
      content: textParts.join('\n'),
      bubbleClass: 'user',
    })
    return results
  }

  results.push({
    label: msg.role.toUpperCase(),
    content: JSON.stringify(msg.content, null, 2),
    bubbleClass: 'assistant',
  })

  return results
}

function MessageBubble({ parsed }: { parsed: ParsedMessage }) {
  const bubbleStyles = {
    user: 'bg-neutral-800 ml-auto',
    assistant: 'bg-neutral-900 border border-neutral-800',
    tool: 'bg-neutral-900/50 border border-neutral-800/50 text-xs',
    'tool-call': 'bg-neutral-900/50 border border-neutral-700/50 text-xs',
  }

  return (
    <div className={`max-w-[85%] md:max-w-[70%] rounded-xl p-3 ${bubbleStyles[parsed.bubbleClass]}`}>
      <div className='flex justify-between mb-1 text-[10px] text-neutral-500'>
        <span className='font-semibold uppercase tracking-wider'>{parsed.label}</span>
      </div>
      {parsed.content && (
        <div className='whitespace-pre-wrap text-sm text-neutral-100 leading-relaxed'>
          {parsed.content}
        </div>
      )}
      {parsed.toolData && (
        <div className='mt-2 p-2 bg-neutral-950/50 rounded-lg font-mono text-xs text-neutral-300 overflow-x-auto whitespace-pre-wrap'>
          {parsed.toolData}
        </div>
      )}
    </div>
  )
}

function MessageGroup({
  message,
}: {
  message: { id: string; messages: ModelMessage[]; timestamp: string }
}) {
  const parsedMessages: ParsedMessage[] = []
  for (const msg of message.messages) {
    parsedMessages.push(...parseModelMessage(msg))
  }

  if (parsedMessages.length === 0) return null

  return (
    <div className='space-y-2'>
      {parsedMessages.map((parsed, idx) => (
        <MessageBubble
          key={`${message.id}-${idx}`}
          parsed={parsed}
        />
      ))}
    </div>
  )
}

export function ChatPage() {
  const { thread } = useLoaderData({ from: '/_app/chat/$userId' })

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='bg-neutral-900 border-b border-neutral-800 px-4 py-3 flex items-center gap-4 shrink-0'>
        <Link
          to='/threads'
          className='text-neutral-400 hover:text-neutral-100 transition-colors'
        >
          <svg
            className='w-5 h-5'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M10 19l-7-7m0 0l7-7m-7 7h18'
            />
          </svg>
        </Link>
        <div className='flex items-center gap-3 min-w-0 flex-1'>
          <div className='w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0'>
            {thread.userName.charAt(0).toUpperCase()}
          </div>
          <div className='min-w-0'>
            <div className='font-semibold text-neutral-100 truncate'>{thread.userName}</div>
            <div className='text-xs text-neutral-500 font-mono truncate'>{thread.externalId}</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className='flex-1 overflow-y-auto p-4 space-y-4'>
        {thread.messages.length === 0 ? (
          <div className='text-center text-neutral-500 py-12'>
            <svg
              className='w-12 h-12 mx-auto mb-4 text-neutral-600'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={1.5}
                d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
              />
            </svg>
            <p>No messages in this conversation</p>
          </div>
        ) : (
          thread.messages.map((msg) => (
            <MessageGroup
              key={msg.id}
              message={msg}
            />
          ))
        )}
      </div>
    </div>
  )
}
