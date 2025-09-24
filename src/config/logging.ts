import {
  ansiColorFormatter,
  configure,
  getConsoleSink,
  type LogLevel,
  type LogRecord,
  type Sink,
} from '@logtape/logtape'
import { AsyncLocalStorage } from 'node:async_hooks'
import { getLokiSink } from './lokiSink'

export async function configureLogging() {
  const isProduction = import.meta.env.NODE_ENV === 'production'
  const isTest = import.meta.env.NODE_ENV === 'test'

  const sinks = {
    console: getConsoleSink({
      formatter: ansiColorFormatter,
    }),
    loki: getLokiSink({
      staticLabels: {
        service_name: 'zapid',
      },
      labelKeys: ['requestId', 'userId'],
    }),
    local: getLocalLogSink(),
  }

  const logLevel: LogLevel = isProduction ? 'info' : 'debug'
  const activeSinks = isProduction ? ['loki'] : isTest ? ['console'] : ['console', 'local']

  await configure({
    sinks,
    contextLocalStorage: new AsyncLocalStorage(),
    loggers: [
      { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: ['console'] },
      { category: 'app', lowestLevel: logLevel, sinks: activeSinks },
      { category: 'infra', lowestLevel: logLevel, sinks: activeSinks },
      { category: 'server', lowestLevel: logLevel, sinks: activeSinks },
    ],
  })
}

function getLocalLogSink(): Sink {
  const endpoint = 'http://localhost:8080/logs'

  return async (record: LogRecord) => {
    try {
      const body = {
        timestamp: record.timestamp,
        level: record.level,
        category: record.category.join('.'),
        message: record.message.length > 0 ? record.message.join(' ') : undefined,
        properties: record.properties,
      }

      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    } catch (error) {
      console.error('Failed to send log to local service:', error)
    }
  }
}

export async function configureEvalLogging() {
  const sinks = {
    console: getConsoleSink({
      formatter: ansiColorFormatter,
    }),
  }

  await configure({
    sinks,
    contextLocalStorage: new AsyncLocalStorage(),
    loggers: [
      { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: ['console'] },
      { category: 'infra', lowestLevel: 'debug', sinks: ['console'] },
      { category: 'eval', lowestLevel: 'debug', sinks: ['console'] },
    ],
  })
}
