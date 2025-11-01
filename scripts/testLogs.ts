// import { configure, getConsoleSink, getLogger } from '@logtape/logtape'
// import { consoleSinkFormatter } from '../src/config/consoleSinkFormatter'

// async function testLogs() {
//   const sinks = {
//     console: getConsoleSink({ formatter: consoleSinkFormatter }),
//   }

//   await configure({
//     sinks,
//     loggers: [
//       { category: ['logtape', 'meta'], lowestLevel: 'warning', sinks: ['console'] },
//       { category: 'infra', lowestLevel: 'debug', sinks: ['console'] },
//       { category: 'server', lowestLevel: 'debug', sinks: ['console'] },
//       { category: 'app', lowestLevel: 'debug', sinks: ['console'] },
//     ],
//   })

//   const infraLogger = getLogger('infra')
//   const serverLogger = getLogger('server')
//   const appLogger = getLogger(['app', 'agent'])

//   appconsole.log('App category message')
//   infraconsole.log('Infra category message')
//   serverconsole.log('Server category message', { endpoint: '/api/test' })

//   appconsole.debug('User action', {
//     userId: 'user123',
//     action: 'send_message',
//     metadata: {
//       messageLength: 42,
//       media: {
//         mimeType: 'image/jpeg',
//         filename: 'test.jpg',
//         storageKey: 'test.jpg',
//         transcription: 'Test transcription',
//         transcriptionEmbedding: [1, 2, 3],
//       },
//       timestamp: new Date().toISOString(),
//     },
//   })

//   infraconsole.warning('API rate limit approaching', {
//     endpoint: '/api/messages',
//     requests: [100, 120, 150, 180],
//     threshold: 200,
//     timeWindow: '1m',
//   })

//   const error = new Error('Test error for logging')
//   appconsole.error('Caught test error', {
//     error: error instanceof Error ? error.message : String(error),
//     stack: error instanceof Error ? error.stack : undefined,
//     context: 'testing-error-handling',
//   })
// }

// if (import.meta.main) {
//   testLogs().catch(console.error)
// }
