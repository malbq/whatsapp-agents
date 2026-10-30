/**
 * Instrumentation entrypoint for production builds.
 * This file is compiled into the executable and ensures Sentry is initialized
 * before any other application modules are loaded.
 *
 * For development, run index.ts directly (see package.json "dev" script).
 */
import * as Sentry from '@sentry/bun'
import pkg from './package.json'

if (import.meta.env.SENTRY_DSN && import.meta.env.NODE_ENV !== 'development') {
  Sentry.init({
    dsn: import.meta.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
    environment: import.meta.env.NODE_ENV,
    release: pkg.version,
    integrations: [
      Sentry.vercelAIIntegration({
        recordInputs: true,
        recordOutputs: true,
      }),
      Sentry.consoleIntegration({ levels: [] }),
    ],
  })

  globalThis.console.log = new Proxy(globalThis.console.log, captureConsoleLog('info'))
  globalThis.console.info = new Proxy(globalThis.console.info, captureConsoleLog('info'))
  globalThis.console.debug = new Proxy(globalThis.console.debug, captureConsoleLog('debug'))
  globalThis.console.warn = new Proxy(globalThis.console.warn, captureConsoleLog('warn'))
  globalThis.console.error = new Proxy(globalThis.console.error, captureConsoleLog('error'))
}

function captureConsoleLog(
  level: 'info' | 'debug' | 'warn' | 'error'
): ProxyHandler<typeof console.log> {
  return {
    apply(target, thisArg, args) {
      Reflect.apply(target, thisArg, args)

      const [msg, attrs] = args
      if (typeof msg !== 'string') return
      if (attrs !== undefined && typeof attrs !== 'object') return

      let logAttrs = attrs ?? {}
      if (level === 'error' && 'error' in logAttrs && logAttrs.error instanceof Error) {
        // capture exceptions in `error` attribute
        Sentry.captureException(logAttrs.error)
        delete logAttrs.error
      }

      let normalizedAttrs: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(logAttrs)) {
        if (typeof value === 'object' && value !== null) {
          for (const [subKey, subValue] of Object.entries(value)) {
            normalizedAttrs[`${key}.${subKey}`] = subValue
          }
        } else {
          normalizedAttrs[key] = value
        }
      }

      Sentry.logger[level](msg, normalizedAttrs)
    },
  }
}

await import('./index')
