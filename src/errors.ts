import type { ComponentType, EntityId } from './agent/frame'

export class MediaHashMismatchError extends Error {
  constructor() {
    super('Media SHA256 mismatch')
    this.name = 'MediaHashMismatchError'
  }
}

export class FailedToDownloadMediaError extends Error {
  constructor() {
    super('Failed to download media')
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
