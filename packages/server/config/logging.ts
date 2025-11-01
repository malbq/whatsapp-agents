// import { configure, fromAsyncSink, getConsoleSink } from '@logtape/logtape'
// import { AsyncLocalStorage } from 'node:async_hooks'
// import { consoleSinkFormatter } from './consoleSinkFormatter'
// import { getLocalServerSink } from './localServerSink'

export async function configureLogging() {
  // const isProduction = import.meta.env.NODE_ENV === 'production'
  // const isTest = import.meta.env.NODE_ENV === 'test'

  // const sinks = {
  //   console: getConsoleSink({ formatter: consoleSinkFormatter, nonBlocking: true }),
  //   local: fromAsyncSink(getLocalServerSink()),
  // }

  // const activeSinks = isProduction ? ['local'] : isTest ? ['console'] : ['console', 'local']

  // await configure({
  //   sinks,
  //   contextLocalStorage: new AsyncLocalStorage(),
  //   loggers: [
  //     { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: ['console'] },
  //     { category: 'app', lowestLevel: 'debug', sinks: activeSinks },
  //     { category: 'infra', lowestLevel: 'debug', sinks: activeSinks },
  //     { category: 'server', lowestLevel: isProduction ? 'info' : 'debug', sinks: activeSinks },
  //   ],
  // })
}

export async function configureEvalLogging() {
  // const sinks = {
  //   console: getConsoleSink({ formatter: consoleSinkFormatter }),
  // }

  // await configure({
  //   sinks,
  //   contextLocalStorage: new AsyncLocalStorage(),
  //   loggers: [
  //     { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: ['console'] },
  //     { category: 'app', lowestLevel: 'debug', sinks: ['console'] },
  //     { category: 'infra', lowestLevel: 'debug', sinks: ['console'] },
  //     { category: 'server', lowestLevel: 'debug', sinks: ['console'] },
  //   ],
  // })
}
