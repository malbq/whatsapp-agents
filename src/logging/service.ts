import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/bun'
import { createLoggingDB, type LogEntry } from './db'

const wsClients = new Set<WebSocket>()
const db = await createLoggingDB()

async function storeLog(logData: Omit<LogEntry, 'id'>) {
  await db.storeLog(logData)

  const logMessage = JSON.stringify(logData)
  wsClients.forEach((client) => {
    if (client.readyState === 1 /* OPEN */) {
      client.send(logMessage)
    }
  })
}

const app = new Hono()

app.get(
  '/ws',
  upgradeWebSocket(() => ({
    onOpen: (_event, ws) => {
      wsClients.add(ws.raw)
    },
    onClose: (_event, ws) => {
      wsClients.delete(ws.raw)
    },
  }))
)

app.post('/', async (c) => {
  try {
    const logData: Omit<LogEntry, 'id' | 'timestamp'> & { timestamp: number } = await c.req.json()
    await storeLog({
      ...logData,
      timestamp: new Date(logData.timestamp),
    })
    return c.json({ success: true })
  } catch (error) {
    console.error('Failed to store log', error)
    return c.json({ error: 'Failed to store log' }, 500)
  }
})

app.get('/', async (c) => {
  const logs = await db.getLogs({ limit: 100 })
  for (const log of logs) {
    for (const property in log.properties) {
      try {
        log.properties[property] = JSON.parse(log.properties[property] as string)
      } catch {}
    }
  }
  return c.html(`<!DOCTYPE html>
    <html>
      <head>
        <title>Log Viewer</title>
        <style>
          :root {
            --color-text: hsl(0, 0%, 100%);
            --color-debug: hsl(0, 0%, 30%);
            --color-info: hsl(190, 50%, 30%);
            --color-warn: hsl(33, 100%, 40%);
            --color-error: hsl(0, 60%, 50%);
            --entry-bg-opacity: 0.2;
            --entry-bg-hover-opacity: 0.4;
          }
          @function --opacity(--color, --opacity) {
            result: oklch(from var(--color) l c h / var(--opacity));
          }
          body {
            font-family: monospace;
            margin: 0;
            background:hsl(0, 0%, 10%);
            color: var(--color-text);
            font-size: 12px;
            line-height: 1;
          }
          .logs {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 8px 8px 80px;
          }
          .log-entry {
            display: grid;
            grid-template-columns: auto auto 1fr;
            grid-template-rows: auto 1fr;
            grid-template-areas: "timestamp category message" "properties properties properties";
            align-items: flex-start;
            flex-wrap: wrap;
            padding: 4px;
            border-radius: 4px;
            border-left: 2px solid;
            line-height: 16px;
            cursor: pointer;
          }
          .info {
            border-left-color: var(--color-info);
            background: --opacity(var(--color-info), var(--entry-bg-opacity));
            &:hover {
              background: --opacity(var(--color-info), var(--entry-bg-hover-opacity));
            }
          }
          .warn {
            border-left-color: var(--color-warn);
            background: --opacity(var(--color-warn), var(--entry-bg-opacity));
            &:hover {
              background: --opacity(var(--color-warn), var(--entry-bg-hover-opacity));
            }
          }
          .error {
            border-left-color: var(--color-error);
            background: --opacity(var(--color-error), var(--entry-bg-opacity));
            &:hover {
              background: --opacity(var(--color-error), var(--entry-bg-hover-opacity));
            }
          }
          .debug {
            border-left-color: var(--color-debug);
            background: --opacity(var(--color-debug), var(--entry-bg-opacity));
            &:hover {
              background: --opacity(var(--color-debug), var(--entry-bg-hover-opacity));
            }
          }
          .timestamp {
            grid-area: timestamp;
            font-size: 10px;
            color: --opacity(var(--color-text), 0.6);
            margin-inline-end: 8px;
          }
          .category {
            grid-area: category;
            font-size: 10px;
            font-weight: bold;
            color: var(--color-text);
            margin-inline-end: 8px;
          }
          .message {
            grid-area: message;
            overflow: auto;
          }
          .message::-webkit-scrollbar {
            display: none;
          }
          .properties-content {
            grid-area: properties;
            background: --opacity(var(--color-text), 0.05);
            padding: 10px;
            border-radius: 2px;
            margin: 2px 0 0;
            white-space: pre-wrap;
          }
          .filters {
            position: sticky;
            top: 0;
            padding: 8px 16px;
            background: hsl(0, 0%, 25%);
            display: flex;
            gap: 8px;
          }
          .filters select,
          .filters input {
            padding: 5px;
            background: hsl(0, 0%, 20%);
            color: hsl(var(--color-text));
            border: 1px solid hsl(0, 0%, 40%);
            border-radius: 3px;
          }
          .ws-status {
            position: fixed;
            z-index: 1;
            top: 4px;
            right: 4px;
            display: flex;
            width: 24px;
            height: 24px;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            letter-spacing: 0.2em;
          }
          .ws-connected {
            background: #155724;
            color: #d4edda;
          }
          .ws-disconnected {
            background: #721c24;
            color: #f8d7da;
          }
          [data-visible='false'], .hidden {
            display: none;
          }
        </style>
      </head>
      <body>
        <div id="ws-status" class="ws-status ws-disconnected">󰖪</div>
        <div class="filters">
          <label>Level: <select id="level-filter">
              <option value="">All</option>
              <option value="info">Info</option>
              <option value="warn">Warn</option>
              <option value="error">Error</option>
              <option value="debug">Debug</option>
            </select></label>
          <label>Filter: <input type="text" id="category-filter"/></label>
        </div>
        <div id="logs" class="logs"></div>
        <script type="application/json" id="initial-logs">
          ${JSON.stringify(logs)}
        </script>
        <script>
          let ws
          let reconnectInterval

          function formatTime(date) {
            return date.getHours().toString().padStart(2, '0') + ':' +
                   date.getMinutes().toString().padStart(2, '0') + ':' +
                   date.getSeconds().toString().padStart(2, '0')
          }

          function connectWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
            ws = new WebSocket(protocol + '//' + window.location.host + '/logs/ws')

            ws.onopen = () => {
              document.getElementById('ws-status').className = 'ws-status ws-connected'
              document.getElementById('ws-status').textContent = '󰖩'
              clearInterval(reconnectInterval)
            }

            ws.onmessage = (event) => {
              const log = JSON.parse(event.data)
              addLogEntry(log)
            }

            ws.onclose = () => {
              document.getElementById('ws-status').className = 'ws-status ws-disconnected'
              document.getElementById('ws-status').textContent = '󰖪'
              reconnectInterval = setInterval(connectWebSocket, 5000)
            }

            ws.onerror = (error) => {
              console.error('WebSocket error:', error)
            }
          }

          function addLogEntry(log) {
            if (typeof log.timestamp === 'string') {
              log.timestamp = new Date(log.timestamp)
            }
            const logsDiv = document.getElementById('logs')
            const logEntry = document.createElement('div')
            logEntry.className = 'log-entry ' + log.level
            logEntry.setAttribute('data-level', log.level)
            logEntry.setAttribute('data-category', log.category)
            logEntry.setAttribute('data-message', log.message || '')
            logEntry.addEventListener('click', () => {
              toggleProperties(logEntry)
            })

            logEntry.innerHTML = \`
              <div class="timestamp"></div>
              <div class="category"></div>
              <div class="message"></div>
              <pre class="properties-content hidden"></pre>
            \`
            logEntry.querySelector('.timestamp').textContent = formatTime(log.timestamp)
            logEntry.querySelector('.category').textContent = log.category
            logEntry.querySelector('.message').textContent = log.message
            logEntry.querySelector('.properties-content').textContent = JSON.stringify(log.properties, null, 2)
            logsDiv.appendChild(logEntry)
            logEntry.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }

          function toggleProperties(element) {
            const content = element.querySelector('.properties-content')
            if (!content) return
            content.classList.toggle('hidden')
          }

          function applyFilters() {
            const levelFilter = document.getElementById('level-filter')?.value || ''
            const categoryFilter = document.getElementById('category-filter').value.toLowerCase()

            const entries = document.querySelectorAll('.log-entry')
            entries.forEach((entry) => {
              const level = entry.getAttribute('data-level')
              const category = entry.getAttribute('data-category').toLowerCase()
              const message = entry.getAttribute('data-message').toLowerCase()

              const levelMatch = !levelFilter || level === levelFilter
              const textMatch = !categoryFilter || category.includes(categoryFilter) || message.includes(categoryFilter)

              if (levelMatch && textMatch) {
                entry.setAttribute('data-visible', 'true')
              } else {
                entry.setAttribute('data-visible', 'false')
              }
            })
          }

          function hydrateLogs() {
            const initialLogsElement = document.getElementById('initial-logs')
            if (initialLogsElement?.textContent) {
              const initialLogs = JSON.parse(initialLogsElement.textContent)
              initialLogs.forEach(log => {
                addLogEntry(log)
              })
              document.getElementById('initial-logs')?.remove()
            }
          }

          document.getElementById('level-filter').addEventListener('change', applyFilters)
          document.getElementById('category-filter').addEventListener('input', applyFilters)

          hydrateLogs()
          connectWebSocket()
        </script>
      </body>
    </html> `)
})

export default app
