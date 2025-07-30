import type { EntityId, Frame } from '../frame'

export async function textIngest(
  frame: Frame,
  messageEntity: EntityId,
  text: string
): Promise<void> {
  frame.addComponent(messageEntity, 'TextContent', { text })
}
