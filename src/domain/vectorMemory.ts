export interface VectorMemory {
  embedding: Array<number>
  metadata: Record<string, any>
  content: string
}
