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

export class WebSearchError extends Error {
  query: string
  status: number
  code: string
  detail: string

  constructor(query: string, status: number, code: string, detail: string) {
    super(`Search failed for query "${query}": [${status} ${code}] ${detail}`)
    this.name = 'WebSearchError'
    this.query = query
    this.status = status
    this.code = code
    this.detail = detail
  }
}

export interface ToolExecutionError {
  error: string
  details: string
}

export class HttpError extends Error {
  status: number
  statusText: string
  body: string

  constructor(status: number, statusText: string, body: string) {
    super(`HTTP error: [${status} ${statusText}] ${body}`)
    this.name = 'HttpError'
    this.status = status
    this.statusText = statusText
    this.body = body
  }
}
