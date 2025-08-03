import type { ComponentType, EntityId } from './agent/frame'

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

export class EntityNotFoundError extends Error {
  constructor(entity: EntityId) {
    super(`Entity ${entity} not found`)
    this.name = 'EntityNotFoundError'
  }
}

export class ComponentNotFoundError extends Error {
  constructor(entity: EntityId, component: ComponentType) {
    super(`Component ${component} not found for entity ${entity}`)
    this.name = 'ComponentNotFoundError'
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

export class ResponseDeliveryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ResponseDeliveryError'
  }
}
