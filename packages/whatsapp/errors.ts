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

export class ResponseDeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResponseDeliveryError'
  }
}
