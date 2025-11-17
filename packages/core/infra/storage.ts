export interface Storage {
  store: (params: { key: string; data: ArrayBuffer; mimeType: string }) => Promise<void>

  retrieve: (key: string) => Promise<{
    data: ArrayBuffer
    mimeType: string
  }>
}
