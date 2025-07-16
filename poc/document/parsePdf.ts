import path from 'node:path'
import { extractText, getDocumentProxy } from 'unpdf'

const buffer = await Bun.file(path.join(import.meta.dir, 'flat.pdf')).bytes()
const doc = await getDocumentProxy(buffer)

const { text, totalPages } = await extractText(doc, { mergePages: true })
// const image = await extractImages(doc, 1)
console.log(text)
console.log('pages:', totalPages)
// Bun.write(path.join(import.meta.dir, 'result.txt'), text)
