import type { DB } from '@batman/core/infra/db'
import { desc, eq } from 'drizzle-orm'
import type { Context } from 'hono'
import type { Child, FC } from 'hono/jsx'
import type { ZapidRepository } from '../db'
import * as schema from '../dbSchema'

interface ModelCost {
  input: number
  output: number
  cache_read?: number
  reasoning?: number
}

interface ChatPageProps {
  users: DB.User[]
  selectedUser?: DB.User
  messages: DB.Message[]
  modelCost: ModelCost | null
}

const PROVIDER = 'openai'
const MODEL_ID = 'gpt-5-mini'

async function fetchModelCost(): Promise<ModelCost | null> {
  try {
    const res = await fetch('https://models.dev/api.json')
    if (!res.ok) return null

    const data = (await res.json()) as Record<
      string,
      { models?: Record<string, { cost?: ModelCost }> }
    >
    return data[PROVIDER]?.models?.[MODEL_ID]?.cost ?? null
  } catch (err) {
    console.error('[fetchModelCost] Error:', err)
    return null
  }
}

export function createChatRoute(db: ZapidRepository) {
  return async (c: Context) => {
    const [users, modelCost] = await Promise.all([
      db.$client.query.user.findMany({
        orderBy: (user, { desc }) => [desc(user.joinedAt)],
      }),
      fetchModelCost(),
    ])

    const selectedUserId = c.req.query('user')
    let selectedUser: (typeof users)[0] | undefined
    let messages: DB.Message[] = []

    if (selectedUserId) {
      selectedUser = users.find((u) => u.id === selectedUserId)
      if (selectedUser) {
        messages = await db.$client
          .select()
          .from(schema.message)
          .where(eq(schema.message.userId, selectedUserId))
          .orderBy(desc(schema.message.timestamp))
          .limit(100)
          .then((rows) => rows.reverse())
      }
    }

    return c.html(
      <ChatPage
        users={users}
        selectedUser={selectedUser}
        messages={messages}
        modelCost={modelCost}
      />
    )
  }
}

const Layout: FC<{ title: string; children: Child }> = ({ title, children }) => (
  <html lang='en'>
    <head>
      <meta charset='UTF-8' />
      <meta
        name='viewport'
        content='width=device-width, initial-scale=1.0'
      />
      <title>{title}</title>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: system-ui;
          background: #fff;
          height: 100dvh;
          display: grid;
          grid-template-columns: auto 1fr;
          overflow: hidden;
        }
        .sidebar {
          background: #fff;
          border-right: 1px solid #e0e0e0;
          display: flex;
          flex-direction: column;
        }
        .user-item {
          display: block;
          padding: 4px 8px;
          border-bottom: 1px solid #f0f0f0;
          text-decoration: none;
          color: inherit;
          transition: background 0.15s;
          white-space: nowrap;
        }
        .user-item:hover {
          background: #f5f5f5;
        }
        .user-item.active {
          background: #e8f5e9;
        }
        .user-name {
          font-weight: 500;
          color: #333;
          margin-bottom: 2px;
        }
        .user-id {
          font-size: 12px;
          color: #888;
        }
        .main {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #e5ddd5;
          overflow-y: auto;
        }
        .chat-header {
          padding: 12px 16px;
          background: #f0f2f5;
          border-bottom: 1px solid #e0e0e0;
        }
        .chat-header h2 {
          font-size: 16px;
          font-weight: 500;
        }
        .chat-header .subtitle {
          font-size: 12px;
          color: #666;
        }
        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }
        .no-messages {
          text-align: center;
          color: #888;
          padding: 40px;
        }
        .message {
          max-width: 65%;
          margin-bottom: 8px;
          padding: 8px 12px;
          border-radius: 8px;
          word-wrap: break-word;
        }
        .message.user {
          background: #dcf8c6;
          margin-left: auto;
        }
        .message.assistant {
          background: #fff;
        }
        .message.tool {
          background: #e8f4fd;
          font-size: 12px;
        }
        .message.tool-call {
          background: #fff3cd;
          font-size: 12px;
        }
        .message-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 11px;
          color: #666;
        }
        .message-role {
          font-weight: 600;
          text-transform: uppercase;
        }
        .message-content {
          white-space: pre-wrap;
          font-size: 14px;
          line-height: 1.4;
        }
        .tool-input, .tool-output {
          font-family: monospace;
          font-size: 11px;
          background: rgba(0,0,0,0.05);
          padding: 4px 6px;
          border-radius: 4px;
          margin-top: 4px;
          overflow-x: auto;
        }
        .select-prompt {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #888;
          font-size: 16px;
        }
        .message-cost {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
          padding-top: 4px;
          border-top: 1px solid rgba(0,0,0,0.08);
        }
        .message-cost span {
          margin-right: 8px;
        }
        .message-cost .cost-label {
          color: #888;
        }
        .message-cost .cost-total {
          font-weight: 600;
        }
      `}</style>
    </head>
    <body>{children}</body>
  </html>
)

const UserListItem: FC<{ user: DB.User; isActive: boolean }> = ({ user, isActive }) => (
  <a
    href={`/chat?user=${user.id}`}
    class={`user-item ${isActive ? 'active' : ''}`}
  >
    <div class='user-name'>{user.name}</div>
    <div class='user-id'>{user.waId}</div>
  </a>
)

interface ParsedMessage {
  label: string
  content: string
  bubbleClass: string
  toolData?: string
}

interface CostBreakdown {
  inputCost: number
  inputTokens: number
  outputCost: number
  outputTokens: number
  cachedCost: number
  cachedTokens: number
  total: number
}

function calculateCost(message: DB.Message, cost: ModelCost): CostBreakdown | null {
  const { usageInputTokens, usageOutputTokens, usageCachedInputTokens, usageReasoningTokens } =
    message
  if (usageInputTokens === null && usageOutputTokens === null) {
    return null
  }

  const cacheRate = cost.cache_read ?? 0

  const inputTokens = (usageInputTokens ?? 0) - (usageCachedInputTokens ?? 0)
  const outputTokens = (usageOutputTokens ?? 0) + (usageReasoningTokens ?? 0)
  const cachedTokens = usageCachedInputTokens ?? 0

  const inputCost = (inputTokens / 1_000_000) * cost.input
  const outputCost = (outputTokens / 1_000_000) * cost.output
  const cachedCost = (cachedTokens / 1_000_000) * cacheRate

  return {
    inputCost,
    inputTokens,
    outputCost,
    outputTokens,
    cachedCost,
    cachedTokens,
    total: inputCost + outputCost + cachedCost,
  }
}

function formatCost(dollars: number): string {
  return `$${dollars.toFixed(4)}`
}

function parseMessage(message: DB.Message): ParsedMessage {
  const msg = message.modelMessage

  // Tool result messages (role === 'tool')
  if (message.role === 'tool' && Array.isArray(msg.content)) {
    const toolResults = msg.content.filter((p) => p.type === 'tool-result')
    if (toolResults.length > 0) {
      const first = toolResults[0] as { toolName?: string; output?: unknown }
      const toolName = first?.toolName ?? 'unknown'
      const output = toolResults
        .map((r) => formatToolOutput((r as { output?: unknown }).output))
        .join('\n')
      return {
        label: `TOOL RESULT: ${toolName}`,
        content: '',
        bubbleClass: 'tool',
        toolData: output,
      }
    }
  }

  // Assistant messages - check for tool calls
  if (message.role === 'assistant' && Array.isArray(msg.content)) {
    const toolCalls = msg.content.filter((p) => p.type === 'tool-call')
    if (toolCalls.length > 0) {
      const first = toolCalls[0] as { toolName?: string; input?: unknown }
      const toolName = first?.toolName ?? 'unknown'
      const input = formatToolOutput(first?.input)
      return {
        label: `TOOL CALL: ${toolName}`,
        content: '',
        bubbleClass: 'tool-call',
        toolData: input,
      }
    }

    // Regular assistant message with structured output (WhatsApp message)
    const textParts = msg.content.filter(
      (p): p is { type: 'text'; text: string } => p.type === 'text'
    )
    if (textParts.length > 0) {
      const text = textParts.map((p) => p.text).join('\n')
      const content = parseWhatsAppOutput(text)
      return {
        label: 'ASSISTANT',
        content,
        bubbleClass: 'assistant',
      }
    }
  }

  // Simple string content
  if (typeof msg.content === 'string') {
    return {
      label: message.role.toUpperCase(),
      content: msg.content,
      bubbleClass: message.role,
    }
  }

  // User messages with mixed content
  if (message.role === 'user' && Array.isArray(msg.content)) {
    const parts = msg.content.map((part) => {
      if (part.type === 'text') return part.text
      if (part.type === 'image') return '[Image]'
      if (part.type === 'file') return '[File]'
      return `[${part.type}]`
    })
    return {
      label: 'USER',
      content: parts.join('\n'),
      bubbleClass: 'user',
    }
  }

  // Fallback
  return {
    label: message.role.toUpperCase(),
    content: JSON.stringify(msg.content, null, 2),
    bubbleClass: message.role,
  }
}

function parseWhatsAppOutput(text: string): string {
  // Try to parse as JSON (structured WhatsApp message output)
  try {
    const parsed = JSON.parse(text)
    const message = parsed?.message ?? parsed

    if (!message?.type) {
      return text
    }

    switch (message.type) {
      case 'text':
        return message.text ?? text
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
      case 'interactive_button':
        return `${message.body}\n\nButtons: [${message.buttons?.join('] [')}]`
      case 'interactive_list': {
        const options =
          message.sections?.flatMap(
            (s: { options?: Array<{ title: string }> }) =>
              s.options?.map((o: { title: string }) => o.title) ?? []
          ) ?? []
        return `${message.body}\n\nOptions: ${options.join(', ')}`
      }
      default:
        return text
    }
  } catch {
    return text
  }
}

function formatToolOutput(result: unknown): string {
  if (result === undefined || result === null) {
    return '(no output)'
  }
  if (typeof result === 'string') {
    return result.length > 500 ? result.slice(0, 500) + '...' : result
  }
  const str = JSON.stringify(result, null, 2) ?? '(no output)'
  return str.length > 500 ? str.slice(0, 500) + '...' : str
}

const MessageBubble: FC<{ message: DB.Message; modelCost: ModelCost | null }> = ({
  message,
  modelCost,
}) => {
  const parsed = parseMessage(message)
  const cost = modelCost ? calculateCost(message, modelCost) : null
  return (
    <div class={`message ${parsed.bubbleClass}`}>
      <div class='message-header'>
        <span class='message-role'>{parsed.label}</span>
      </div>
      {parsed.content && <div class='message-content'>{parsed.content}</div>}
      {parsed.toolData && <div class='tool-output'>{parsed.toolData}</div>}
      {cost && (
        <div class='message-cost'>
          <span>
            <span class='cost-label'>cached:</span>
            {formatCost(cost.cachedCost)} ({cost.cachedTokens}t)
          </span>
          <span>
            <span class='cost-label'>in:</span>
            {formatCost(cost.inputCost)} ({cost.inputTokens}t)
          </span>
          <span>
            <span class='cost-label'>out:</span>
            {formatCost(cost.outputCost)} ({cost.outputTokens}
            t)
          </span>
          <span class='cost-total'>= {formatCost(cost.total)}</span>
        </div>
      )}
    </div>
  )
}

export const ChatPage: FC<ChatPageProps> = ({ users, selectedUser, messages, modelCost }) => (
  <Layout title={`Zapid Chat - ${selectedUser?.name ?? 'Select User'}`}>
    <aside class='sidebar'>
      {users.map((user) => (
        <UserListItem
          key={user.id}
          user={user}
          isActive={selectedUser?.id === user.id}
        />
      ))}
    </aside>
    <main class='main'>
      {selectedUser && (
        <>
          <div class='chat-header'>
            <h2>{selectedUser.name}</h2>
            <div class='subtitle'>{selectedUser.waId}</div>
          </div>
          <div class='messages'>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                modelCost={modelCost}
              />
            ))}
          </div>
        </>
      )}
    </main>
  </Layout>
)
