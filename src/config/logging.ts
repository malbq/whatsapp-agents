import { ansiColorFormatter, configure, getConsoleSink, type LogLevel } from '@logtape/logtape'
import { getOpenTelemetrySink } from '@logtape/otel'
import { AsyncLocalStorage } from 'node:async_hooks'

export async function configureLogging() {
  const isProduction = import.meta.env.NODE_ENV === 'production'
  const isTest = import.meta.env.NODE_ENV === 'test'

  const sinks = {
    console: getConsoleSink({
      formatter: ansiColorFormatter,
    }),
    otel: getOpenTelemetrySink({
      serviceName: 'zapid',
    }),
  }

  const logLevel: LogLevel = isProduction ? 'info' : 'debug'
  const activeSinks = isProduction ? ['otel'] : isTest ? ['console'] : ['console', 'otel']

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
