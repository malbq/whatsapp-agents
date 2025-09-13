import { getLogger } from '@logtape/logtape'
import { extractText, getDocumentProxy } from 'unpdf'
import { spreadError } from './spreadError'

const logger = getLogger(['app', 'utils', 'parsePdf'])

export async function parsePdf(file: ArrayBuffer) {
  try {
    const copy = file.slice(0)
    const doc = await getDocumentProxy(copy)
    const { text } = await extractText(doc, { mergePages: true })
    return text
  } catch (error) {
    logger.error('Error parsing PDF', { ...spreadError(error) })
    return ''
  }
}
