import { ComponentNotFoundError, EntityNotFoundError } from '../errors'
import type {
  DocumentContentComponent,
  ImageContentComponent,
  MediaComponent,
  MediaMetadataComponent,
  MessageComponent,
  MessageIdComponent,
  StoredMediaComponent,
  TextContentComponent,
  UserComponent,
  VectorEmbeddingComponent,
} from './components'

export type EntityId = number
export type ComponentType =
  | 'DocumentContent'
  | 'ImageContent'
  | 'Media'
  | 'MediaMetadata'
  | 'Message'
  | 'MessageId'
  | 'StoredMedia'
  | 'TextContent'
  | 'User'
  | 'VectorEmbedding'

export type ComponentMap = {
  DocumentContent: DocumentContentComponent
  ImageContent: ImageContentComponent
  Media: MediaComponent
  MediaMetadata: MediaMetadataComponent
  Message: MessageComponent
  MessageId: MessageIdComponent
  StoredMedia: StoredMediaComponent
  TextContent: TextContentComponent
  User: UserComponent
  VectorEmbedding: VectorEmbeddingComponent
}

export class Frame {
  private entities: Map<EntityId, Partial<ComponentMap>> = new Map()
  private nextId: number = 1
  public readonly USER_ENTITY_ID = 0

  constructor() {
    this.entities.set(this.USER_ENTITY_ID, {})
  }

  createEntity(): EntityId {
    const id = this.nextId++
    this.entities.set(id, {})
    return id
  }

  addComponent<K extends ComponentType>(entity: EntityId, type: K, data: ComponentMap[K]) {
    const components = this.entities.get(entity)
    if (!components) {
      throw new EntityNotFoundError(entity)
    }
    components[type] = data
  }

  getComponent<K extends ComponentType>(entity: EntityId, type: K): ComponentMap[K] | undefined {
    const components = this.entities.get(entity)
    if (!components) {
      throw new EntityNotFoundError(entity)
    }
    if (!(type in components)) {
      return
    }
    return components[type] as ComponentMap[K]
  }

  getRequiredComponent<K extends ComponentType>(entity: EntityId, type: K): ComponentMap[K] {
    const components = this.entities.get(entity)
    if (!components) {
      throw new EntityNotFoundError(entity)
    }
    if (!(type in components)) {
      throw new ComponentNotFoundError(entity, type)
    }
    return components[type] as ComponentMap[K]
  }

  query(components: ComponentType[]): EntityId[] {
    return Array.from(this.entities.keys()).filter((id) =>
      components.every((c) => this.entities.get(id)?.[c] !== undefined)
    )
  }
}
