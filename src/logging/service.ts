import { getLogger } from '@logtape/logtape'
import { Hono } from 'hono'
import { upgradeWebSocket } from 'hono/bun'
import { spreadError } from '../utils/spreadError'
import { createLoggingDB, type LogEntry } from './db'

const logger = getLogger(['logging', 'service'])

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
    const logData: Omit<LogEntry, 'id'> = await c.req.json()
    await storeLog(logData)
    return c.json({ success: true })
  } catch (error) {
    logger.error('Failed to store log', { ...spreadError(error) })
    return c.json({ error: 'Failed to store log' }, 500)
  }
})

app.get('/', async (c) => {
  const logs = await db.getLogs({ limit: 100 })
  for (const log of logs) {
    for (const property in log.properties) {
      try {
        log.properties[property] = JSON.parse(log.properties[property])
      } catch {}
    }
  }
  return c.html(`<!DOCTYPE html>
    <html>
      <head>
        <title>Log Viewer</title>
        <style>
          :root {
            --color-text: 0, 0%, 100%;
            --color-debug: 0, 0%, 30%;
            --color-info: 190, 50%, 30%;
            --color-warn: 33, 100%, 40%;
            --color-error: 0, 60%, 50%;
            --entry-opacity: 0.2;
          }
          body {
            font-family: monospace;
            margin: 8px;
            background:hsl(0, 0%, 10%);
            color: hsl(var(--color-text));
            font-size: 12px;
            line-height: 1;
          }
          #logs {
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          .log-entry {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            padding: 4px;
            border-radius: 4px;
            border-left: 2px solid;

            &[data-visible='false'] {
              display: none;
            }
          }
          .info {
            border-left-color:hsl(var(--color-info));
            background:hsla(var(--color-info), var(--entry-opacity));
          }
          .warn {
            border-left-color: hsl(var(--color-warn));
            background: hsla(var(--color-warn), var(--entry-opacity));
          }
          .error {
            border-left-color:hsl(var(--color-error));
            background:hsla(var(--color-error), var(--entry-opacity));
          }
          .debug {
            border-left-color:hsl(var(--color-debug));
            background:hsla(var(--color-debug), var(--entry-opacity));
          }
          .timestamp {
            font-size: 10px;
            color: hsla(var(--color-text), 0.6);
            margin-inline-end: 8px;
          }
          .category {
            font-size: 10px;
            font-weight: bold;
            color: hsla(var(--color-text), 1);
            margin-inline-end: 8px;
          }
          .message {
            margin: 5px 0;
            white-space: pre-wrap;
            flex: 1 0;
          }
          .properties-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            height: 16px;
            width: 16px;
            border-radius: 2px;
            color: #fff;
            margin-inline-end: 4px;
            &:hover {
              background-color: rgba(255 255 255 / 0.1);
            }
          }
          .properties-content {
            flex: 1 0 90%;
            display: none;
            background:rgba(255 249 250 / 0.05);
            padding: 10px;
            border-radius: 2px;
            margin: 2px 0 0;
          }
          .filters {
            margin-bottom: 8px;
            padding: 4px 8px;
            background:hsl(0, 0%, 25%);
            border-radius: 4px;
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
        </style>
      </head>
      <body>
        <div id="ws-status" class="ws-status ws-disconnected">
          󰖪
        </div>
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
        <div id="logs">
          ${logs
            .map(
              (log) => `
                <div
                  class="log-entry ${log.level}"
                  data-level="${log.level}"
                  data-category="${log.category}"
                  data-message="${log.message || ''}"
                >
                  <div class="timestamp">${log.timestamp.getHours()}:${log.timestamp.getMinutes()}:${log.timestamp.getSeconds()}</div>
                  ${
                    log.properties
                      ? `<span class="properties-toggle" onclick="toggleProperties(this)"></span>`
                      : ''
                  }
                  <div class="category">${log.category}</div>
                  ${log.message ? `<div class="message">${log.message}</div>` : ''}
                  ${
                    log.properties
                      ? `<pre class="properties-content">${JSON.stringify(
                          log.properties,
                          null,
                          2
                        )}</pre>`
                      : ''
                  }
                </div>
              `
            )
            .join('')}
        </div>
        <script>
          let ws
          let reconnectInterval

          function connectWebSocket() {
            ws = new WebSocket('ws://' + window.location.host + '/logs/ws')

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
            const logsDiv = document.getElementById('logs')
            const logEntry = document.createElement('div')
            logEntry.className = 'log-entry ' + log.level
            logEntry.setAttribute('data-level', log.level)
            logEntry.setAttribute('data-category', log.category)
            logEntry.setAttribute('data-message', log.message || '')

            logEntry.innerHTML = \`
    <span class="properties-toggle" onclick="toggleProperties(this)"></span>
    <div class="timestamp">\${log.timestamp.getHours()}:\${log.timestamp.getMinutes()}:\${log.timestamp.getSeconds()}</div>
    <div class="category">\${log.category}</div>
    \${log.message ? \`<div class="message">\${log.message}</div>\` : ''}
    \${
      log.properties
        ? \`
        <pre class="properties-content">\${JSON.stringify(log.properties, null, 2)}</pre>
    \`
        : ''
    }
  \`

            logsDiv.appendChild(logEntry)
            window.scrollTo(0, document.body.scrollHeight)
          }

          function toggleProperties(element) {
            const content = element.parentElement.querySelector('.properties-content')
            if (content.style.display === 'block') {
              content.style.display = 'none'
              element.textContent = ''
            } else {
              content.style.display = 'block'
              element.textContent = ''
            }
          }

          function applyFilters() {
            const levelFilter = document.getElementById('level-filter').value
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

          document.getElementById('level-filter').addEventListener('change', applyFilters)
          document.getElementById('category-filter').addEventListener('input', applyFilters)

          connectWebSocket()
        </script>
      </body>
    </html> `)
})

export default app
