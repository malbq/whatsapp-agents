import { extractText, getDocumentProxy } from 'unpdf'
import { spreadError } from './spreadError'

export async function parsePdf(file: ArrayBuffer) {
  try {
    const copy = file.slice(0)
    const doc = await getDocumentProxy(copy)
    const { text } = await extractText(doc, { mergePages: true })
    return text.trim()
  } catch (error) {
    console.error('Error parsing PDF', { ...spreadError(error) })
    return ''
  }
}
