export class FailedToPersistUserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FailedToPersistUserError'
  }
}

export class MediaHashMismatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaHashMismatchError'
  }
}

export class FailedToDownloadMediaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FailedToDownloadMediaError'
  }
}

export class EmbeddingsGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmbeddingsGenerationError'
  }
}

export class IngestionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IngestionError'
  }
}

export class ResponseGenerationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResponseGenerationError'
  }
}

export class FileRetrievalError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileRetrievalError'
  }
}

export class ResponseDeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResponseDeliveryError'
  }
}

export interface ToolExecutionError {
  error: string
  details: string
}
