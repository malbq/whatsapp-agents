export function spreadError(error: unknown) {
  return {
    error: error instanceof Error ? error.name : 'Unknown',
    errorMessage: String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }
}
