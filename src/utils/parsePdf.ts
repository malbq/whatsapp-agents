import { extractText, getDocumentProxy } from 'unpdf'

export async function parsePdf(file: ArrayBuffer) {
  try {
    const doc = await getDocumentProxy(file)
    const { text } = await extractText(doc, { mergePages: true })
    return text
  } catch (error) {
    console.error('parsePdf error', (error as Error).message)
    return ''
  }
}
