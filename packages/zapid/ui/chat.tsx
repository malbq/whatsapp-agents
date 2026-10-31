import type { DB } from '@wa/core/infra/db'
import type { Storage } from '@wa/core/infra/storage'
import { desc, eq, inArray } from 'drizzle-orm'
import type { Context } from 'hono'
import { raw } from 'hono/html'
import type { Child, FC } from 'hono/jsx'
import type { ZapidRepository } from '../db'
import * as schema from '../dbSchema'

interface MessageWithUsage extends DB.Message {
  usages: DB.TokenUsage[]
  imageDataUrl?: string
}

interface TokenPricing {
  input: number
  output: number
  cache_read: number
}

interface ModelPricing {
  name: string
  pricing: TokenPricing
}

const MODEL_CONFIGS = [
  { provider: 'openai', model: 'gpt-5-mini', name: 'GPT-5 Mini' },
  { provider: 'xai', model: 'grok-4-1-fast', name: 'Grok 4.1 Fast' },
  { provider: 'xai', model: 'grok-4-1-fast-non-reasoning', name: 'Grok 4.1 Fast NR' },
  { provider: 'google', model: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
] as const

interface ChatPageProps {
  users: DB.User[]
  selectedUser?: DB.User
  messages: MessageWithUsage[]
  modelPricing: ModelPricing[]
}

async function fetchPricing(): Promise<ModelPricing[]> {
  try {
    const res = await fetch('https://models.dev/api.json')
    const data = (await res.json()) as Record<
      string,
      { models?: Record<string, { cost?: TokenPricing }> }
    >
    const results: ModelPricing[] = []
    for (const cfg of MODEL_CONFIGS) {
      const cost = data?.[cfg.provider]?.models?.[cfg.model]?.cost
      if (cost) {
        results.push({ name: cfg.name, pricing: cost })
      }
    }
    return results
  } catch {
    return []
  }
}

export function createChatRoute(db: ZapidRepository, storage: Storage) {
  return async (c: Context) => {
    const [users, modelPricing] = await Promise.all([
      db.$client.query.user.findMany({
        orderBy: (user) => [desc(user.joinedAt)],
      }),
      fetchPricing(),
    ])

    const selectedUserId = c.req.query('user')
    let selectedUser: (typeof users)[0] | undefined
    let messages: MessageWithUsage[] = []

    if (selectedUserId) {
      selectedUser = users.find((u) => u.id === selectedUserId)
      if (selectedUser) {
        const rawMessages = await db.$client
          .select({
            message: schema.message,
            storageKey: schema.resource.storageKey,
            mimeType: schema.resource.mimeType,
          })
          .from(schema.message)
          .leftJoin(schema.resource, eq(schema.message.resourceId, schema.resource.id))
          .where(eq(schema.message.userId, selectedUserId))
          .orderBy(desc(schema.message.timestamp))
          .limit(100)
          .then((rows) => rows.toReversed())

        if (rawMessages.length > 0) {
          const messageIds = rawMessages.map((m) => m.message.id)
          const usages = await db.$client
            .select()
            .from(schema.tokenUsage)
            .where(inArray(schema.tokenUsage.messageId, messageIds))

          const usageByMessageId = new Map<string, DB.TokenUsage[]>()
          for (const u of usages) {
            const list = usageByMessageId.get(u.messageId) ?? []
            list.push(u)
            usageByMessageId.set(u.messageId, list)
          }

          const imageDataUrls = new Map<string, string>()
          const imagesToFetch = rawMessages.filter(
            (r) => r.storageKey && r.mimeType?.startsWith('image/')
          )
          await Promise.all(
            imagesToFetch.map(async (r) => {
              try {
                const data = await storage.retrieve(r.storageKey!)
                const base64 = Buffer.from(data.data).toString('base64')
                imageDataUrls.set(r.message.id, `data:${r.mimeType};base64,${base64}`)
              } catch {
                console.warn(`Failed to retrieve image for message ${r.message.id}`)
              }
            })
          )

          messages = rawMessages.map((r) =>
            Object.assign(r.message, {
              usages: usageByMessageId.get(r.message.id) ?? [],
              imageDataUrl: imageDataUrls.get(r.message.id),
            })
          )
        }
      }
    }

    return c.html(
      <ChatPage
        users={users}
        selectedUser={selectedUser}
        messages={messages}
        modelPricing={modelPricing}
      />
    )
  }
}

const Layout: FC<{ title: string; children: Child }> = ({ title, children }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title}</title>
      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: system-ui;
          background: #0a0a0a;
          color: #f0f0f0;
          height: 100dvh;
          display: grid;
          grid-template-columns: auto 1fr;
          overflow: hidden;
        }
        .sidebar {
          background: #0f0f0f;
          border-right: 1px solid #1a1a1a;
          display: flex;
          flex-direction: column;
        }
        .user-item {
          display: block;
          padding: 4px 8px;
          border-bottom: 1px solid #1a1a1a;
          text-decoration: none;
          color: inherit;
          transition: background 0.15s;
          white-space: nowrap;
        }
        .user-item:hover {
          background: #1a1a1a;
        }
        .user-item.active {
          background: #252525;
        }
        .user-name {
          font-weight: 500;
          color: #f0f0f0;
          margin-bottom: 2px;
        }
        .user-id {
          font-size: 12px;
          color: #666;
        }
        .main {
          display: flex;
          flex-direction: column;
          background: #0a0a0a;
          overflow: hidden;
          min-height: 0;
        }
        .chat-header {
          padding: 12px 16px;
          background: #111;
          border-bottom: 1px solid #1a1a1a;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }
        .header-info h2 {
          font-size: 16px;
          font-weight: 500;
          color: #f0f0f0;
        }
        .header-info .subtitle {
          font-size: 12px;
          color: #666;
        }
        .header-price-table {
          font-size: 14px;
          border-collapse: collapse;
        }
        .header-price-table td {
          padding: 1px 8px 1px 0;
        }
        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          min-height: 0;
        }
        .no-messages {
          text-align: center;
          color: #555;
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
          background: #1f1f1f;
          margin-left: auto;
        }
        .message.assistant {
          background: #161616;
        }
        .message.tool {
          border: 1px solid #141414;
          font-size: 12px;
        }
        .message.tool-call {
          border: 1px solid #1a1a1a;
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
          color: #f0f0f0;
        }
        .tool-input, .tool-output {
          font-family: monospace;
          background: rgba(255,255,255,0.04);
          padding: 4px 6px;
          border-radius: 4px;
          margin-top: 4px;
          overflow-x: auto;
          color: #f0f0f0;
        }
        .message-usage {
          font-size: 11px;
          color: #a0a0a0;
          margin-top: 6px;
          padding-top: 4px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .usage-items {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .usage-item {
          display: inline-flex;
          gap: 2px;
        }
        .usage-label {
          color: #777777;
        }
        .usage-total {
          font-weight: 600;
          color: #b0b0b0;
        }
        .price-table {
          margin-top: 6px;
          font-size: 10px;
          border-collapse: collapse;
          width: auto;
        }
        .price-table td {
          padding: 2px 8px 2px 0;
        }
        .price-model {
          color: #777777;
        }
        .price-cost {
          font-family: monospace;
          text-align: right;
          color: #b0b0b0;
        }
        .message-image {
          max-width: 100%;
          max-height: 300px;
          border-radius: 4px;
          margin-bottom: 6px;
          display: block;
        }
      `}</style>
    </head>
    <body>
      {children}
      <script>
        {raw(`
          const messages = document.querySelector('.messages')
          if (messages) messages.scrollTop = messages.scrollHeight
        `)}
      </script>
    </body>
  </html>
)

const UserListItem: FC<{ user: DB.User; isActive: boolean }> = ({ user, isActive }) => (
  <a href={`/chat?user=${user.id}`} class={`user-item ${isActive ? 'active' : ''}`}>
    <div class="user-name">{user.name}</div>
    <div class="user-id">{user.waId}</div>
  </a>
)

interface ParsedMessage {
  label: string
  content: string
  bubbleClass: string
  toolData?: string
  modelMessageIndex: number
}

interface UsageSummary {
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  reasoningTokens: number
  totalTokens: number
  source: string | null
}

function getTotalUsage(messages: MessageWithUsage[]): UsageSummary {
  let inputTokens = 0
  let outputTokens = 0
  let cachedTokens = 0
  let reasoningTokens = 0
  let totalTokens = 0

  for (const msg of messages) {
    for (const u of msg.usages) {
      inputTokens += u.inputTokens
      outputTokens += u.outputTokens
      cachedTokens += u.cachedInputTokens ?? 0
      reasoningTokens += u.reasoningTokens ?? 0
      totalTokens += u.totalTokens
    }
  }

  return { inputTokens, outputTokens, cachedTokens, reasoningTokens, totalTokens, source: null }
}

function getUsageForIndex(usages: DB.TokenUsage[], index: number): UsageSummary | null {
  const matching = usages.filter((u) => u.modelMessageIndex === index)
  if (matching.length === 0) return null

  return {
    inputTokens: matching.reduce((sum, u) => sum + u.inputTokens, 0),
    outputTokens: matching.reduce((sum, u) => sum + u.outputTokens, 0),
    cachedTokens: matching.reduce((sum, u) => sum + (u.cachedInputTokens ?? 0), 0),
    reasoningTokens: matching.reduce((sum, u) => sum + (u.reasoningTokens ?? 0), 0),
    totalTokens: matching.reduce((sum, u) => sum + u.totalTokens, 0),
    source: matching[0]?.source ?? null,
  }
}

function getUnindexedUsage(usages: DB.TokenUsage[]): UsageSummary | null {
  const matching = usages.filter((u) => u.modelMessageIndex === null)
  if (matching.length === 0) return null

  return {
    inputTokens: matching.reduce((sum, u) => sum + u.inputTokens, 0),
    outputTokens: matching.reduce((sum, u) => sum + u.outputTokens, 0),
    cachedTokens: matching.reduce((sum, u) => sum + (u.cachedInputTokens ?? 0), 0),
    reasoningTokens: matching.reduce((sum, u) => sum + (u.reasoningTokens ?? 0), 0),
    totalTokens: matching.reduce((sum, u) => sum + u.totalTokens, 0),
    source: matching[0]?.source ?? null,
  }
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}

function parseMessage(message: DB.Message): ParsedMessage[] {
  const results: ParsedMessage[] = []

  for (let i = 0; i < message.messages.length; i++) {
    const msg = message.messages[i]
    if (!msg) continue

    if (msg.role === 'tool' && Array.isArray(msg.content)) {
      const toolResults = (
        msg.content as Array<{ type: string; toolName?: string; output?: unknown }>
      ).filter((p) => p.type === 'tool-result')
      if (toolResults.length > 0) {
        const first = toolResults[0]
        const toolName = first?.toolName ?? 'unknown'
        const output = toolResults.map((r) => formatToolOutput(r.output)).join('\n')
        results.push({
          label: `TOOL RESULT: ${toolName}`,
          content: '',
          bubbleClass: 'tool',
          toolData: output,
          modelMessageIndex: i,
        })
        continue
      }
    }

    if (msg.role === 'assistant' && Array.isArray(msg.content)) {
      const toolCalls = (
        msg.content as Array<{ type: string; toolName?: string; input?: unknown }>
      ).filter((p) => p.type === 'tool-call')
      if (toolCalls.length > 0) {
        const first = toolCalls[0]
        const toolName = first?.toolName ?? 'unknown'
        const input = formatToolOutput(first?.input)
        results.push({
          label: `TOOL CALL: ${toolName}`,
          content: '',
          bubbleClass: 'tool-call',
          toolData: input,
          modelMessageIndex: i,
        })
        continue
      }

      const textParts = (msg.content as Array<{ type: string; text?: string }>).filter(
        (p): p is { type: 'text'; text: string } => p.type === 'text'
      )
      if (textParts.length > 0) {
        const text = textParts.map((p) => p.text).join('\n')
        const content = parseWhatsAppOutput(text)
        results.push({
          label: 'ASSISTANT',
          content,
          bubbleClass: 'assistant',
          modelMessageIndex: i,
        })
        continue
      }
    }

    if (typeof msg.content === 'string') {
      results.push({
        label: msg.role.toUpperCase(),
        content: msg.content,
        bubbleClass: msg.role,
        modelMessageIndex: i,
      })
      continue
    }

    if (msg.role === 'user' && Array.isArray(msg.content)) {
      const textParts: string[] = []
      for (const part of msg.content as Array<{ type: string; text?: string }>) {
        if (part.type === 'text') {
          textParts.push(part.text ?? '')
        } else if (part.type === 'file') {
          textParts.push('[File]')
        }
      }
      results.push({
        label: 'USER',
        content: textParts.join('\n'),
        bubbleClass: 'user',
        modelMessageIndex: i,
      })
      continue
    }

    results.push({
      label: msg.role.toUpperCase(),
      content: JSON.stringify(msg.content, null, 2),
      bubbleClass: msg.role,
      modelMessageIndex: i,
    })
  }

  return results
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

function calculateCost(usage: UsageSummary, pricing: TokenPricing): number {
  const inputCost = ((usage.inputTokens - usage.cachedTokens) / 1_000_000) * pricing.input
  const outputCost = ((usage.outputTokens + usage.reasoningTokens) / 1_000_000) * pricing.output
  const cacheCost = (usage.cachedTokens / 1_000_000) * pricing.cache_read
  return inputCost + outputCost + cacheCost
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  return `$${cost.toFixed(2)}`
}

const UsageDisplay: FC<{ usage: UsageSummary; modelPricing: ModelPricing[] }> = ({
  usage,
  modelPricing,
}) => {
  const costs = modelPricing.map((mp) => ({
    name: mp.name,
    cost: calculateCost(usage, mp.pricing),
  }))

  return (
    <div class="message-usage">
      <div class="usage-items">
        <span class="usage-item">
          <span class="usage-label">in:</span> {formatTokens(usage.inputTokens)}
        </span>
        {usage.cachedTokens > 0 && (
          <span class="usage-item">
            <span class="usage-label">cached:</span> {formatTokens(usage.cachedTokens)}
          </span>
        )}
        <span class="usage-item">
          <span class="usage-label">out:</span> {formatTokens(usage.outputTokens)}
        </span>
        {usage.reasoningTokens > 0 && (
          <span class="usage-item">
            <span class="usage-label">reasoning:</span> {formatTokens(usage.reasoningTokens)}
          </span>
        )}
        <span class="usage-item usage-total">= {formatTokens(usage.totalTokens)} tokens</span>
      </div>
      {costs.length > 0 && (
        <table class="price-table">
          <tbody>
            {costs.map((c) => (
              <tr key={c.name}>
                <td class="price-model">{c.name}</td>
                <td class="price-cost">{formatCost(c.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

const MessageBubble: FC<{ message: MessageWithUsage; modelPricing: ModelPricing[] }> = ({
  message,
  modelPricing,
}) => {
  const parsedMessages = parseMessage(message)
  const unindexedUsage = getUnindexedUsage(message.usages)

  return (
    <>
      {parsedMessages.map((parsed, index) => {
        const usage = getUsageForIndex(message.usages, parsed.modelMessageIndex)
        const showUnindexed = index === 0 && unindexedUsage

        return (
          <div key={index} class={`message ${parsed.bubbleClass}`}>
            <div class="message-header">
              <span class="message-role">{parsed.label}</span>
            </div>
            {index === 0 && message.imageDataUrl && (
              <img src={message.imageDataUrl} class="message-image" alt="User sent image" />
            )}
            {parsed.content && <div class="message-content">{parsed.content}</div>}
            {parsed.toolData && <div class="tool-output">{parsed.toolData}</div>}
            {showUnindexed && <UsageDisplay usage={unindexedUsage} modelPricing={modelPricing} />}
            {usage && <UsageDisplay usage={usage} modelPricing={modelPricing} />}
          </div>
        )
      })}
    </>
  )
}

const ChatPage: FC<ChatPageProps> = ({ users, selectedUser, messages, modelPricing }) => {
  const totalUsage = getTotalUsage(messages)
  const totalCosts = modelPricing.map((mp) => ({
    name: mp.name,
    cost: calculateCost(totalUsage, mp.pricing),
  }))

  return (
    <Layout title={`Zapid Chat - ${selectedUser?.name ?? 'Select User'}`}>
      <aside class="sidebar">
        {users.map((user) => (
          <UserListItem key={user.id} user={user} isActive={selectedUser?.id === user.id} />
        ))}
      </aside>
      <main class="main">
        {selectedUser && (
          <>
            <div class="chat-header">
              <div class="header-info">
                <h2>{selectedUser.name}</h2>
                <div class="subtitle">{selectedUser.waId}</div>
              </div>
              {totalCosts.length > 0 && (
                <table class="header-price-table">
                  <tbody>
                    {totalCosts.map((c) => (
                      <tr key={c.name}>
                        <td class="price-model">{c.name}</td>
                        <td class="price-cost">{formatCost(c.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div class="messages">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} modelPricing={modelPricing} />
              ))}
            </div>
          </>
        )}
      </main>
    </Layout>
  )
}
