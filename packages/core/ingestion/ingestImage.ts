import type { ImageMessage } from '@batman/whatsapp'
import { analyzeImage } from '../ai/analyzeImage'
import { IngestionError } from '../errors'
import { spreadError } from '../utils/spreadError'

export async function ingestImage(message: ImageMessage): Promise<string> {
  try {
    const base64Image = Buffer.from(message.data).toString('base64')
    const description = await analyzeImage({
      imageUrl: `data:${message.mimeType};base64,${base64Image}`,
      caption: message.caption,
    })
    let content = `Image description: ${description}`
    if (message.caption) {
      content = `${content}\n\nCaption: ${message.caption}`
    }
    return content
  } catch (error) {
    console.error('Image ingestion error', { ...spreadError(error) })
    throw new IngestionError('Failed to analyze image')
  }
}
