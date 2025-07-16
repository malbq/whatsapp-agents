import nlp from 'compromise'
import { retext } from 'retext'
import retextReadability from 'retext-readability'

export async function splitIntoSentences(text: string): Promise<string[]> {
  const parsed = text
    .toWellFormed()
    .replace(/\n+/g, ' ')
    .replace(/ +/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/;/g, '.')
  const readable = await retext().use(retextReadability).process(parsed)
  return nlp(readable.toString()).sentences().out('array')
}
