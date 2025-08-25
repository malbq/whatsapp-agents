import { ansiColorFormatter, configure, getConsoleSink, type LogLevel } from '@logtape/logtape'
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
  }

  const logLevel: LogLevel = isProduction ? 'info' : 'debug'
  const activeSinks = isProduction ? ['loki'] : isTest ? ['console'] : ['console', 'loki']

  await configure({
    sinks,
    contextLocalStorage: new AsyncLocalStorage(),
    loggers: [
      { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: ['console'] },
      { category: 'app', lowestLevel: logLevel, sinks: activeSinks },
      { category: 'server', lowestLevel: logLevel, sinks: activeSinks },
    ],
  })
}
