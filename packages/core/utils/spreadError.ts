import { AISDKError } from 'ai'

export function spreadError(error: unknown) {
  if (AISDKError.isInstance(error)) {
    return Object.fromEntries(Object.entries(error))
  }
  return {
    error: String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }
}
