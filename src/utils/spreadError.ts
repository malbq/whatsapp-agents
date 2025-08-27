export function spreadError(error: unknown) {
  return {
    error: error instanceof Error ? error.name : 'Unknown',
    errorMessage: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }
}
