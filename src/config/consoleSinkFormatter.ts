import type { LogLevel, LogRecord, TextFormatter } from '@logtape/logtape'

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const DIM = '\x1b[2m'

const levelColor = {
  info: '\x1b[0m',
  debug: '\x1b[34m',
  warning: '\x1b[33m',
  error: '\x1b[31m',
  trace: '\x1b[0m',
  fatal: '\x1b[0m',
}

const levelAbbr = {
  debug: '',
  info: '',
  warning: '',
  error: '',
  trace: '',
  fatal: '',
}

function fg(level: LogLevel, text: string) {
  return `${levelColor[level]}${text}${RESET}`
}

export const consoleSinkFormatter: TextFormatter = (record: LogRecord) => {
  const level = levelAbbr[record.level]
  const timestamp = new Date(record.timestamp).toISOString().slice(11, 23)
  const category = record.category.join('.')
  const message = record.message.length > 0 ? `${record.message.join(' ')}` : ''

  const properties =
    Object.keys(record.properties).length > 0 ? `${prettyJson(record.properties)}` : ''

  return `${fg(record.level, level)} ${fg(record.level, `${DIM}${timestamp} ${category}`)}
${fg(record.level, `${BOLD}${message}`)}${
    properties.length > 0 ? `\n${DIM}${properties}${RESET}` : ''
  }`
}

function prettyJson(value: any) {
  return JSON.stringify(value, null, 4)
    .replace(/^\{\n/, '')
    .replace(/\n\}/, '')
    .replace(/^(\s+)"(.+?)"/gm, '$1$2')
}
