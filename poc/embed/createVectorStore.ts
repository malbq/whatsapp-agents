import path from 'node:path'
import data from '../../eval/intent_classification_data.json'
import { generateEmbeddings } from './generateEmbeddings'

export interface Vector {
  id: number
  text: string
  embedding: number[]
}

const store: Vector[] = []

let id = 0
const texts = data.map(({ input }) => input)
const embeddings = await generateEmbeddings(texts)

for (let i = 0; i < data.length; i++) {
  const text = texts[i]
  const embedding = embeddings[i]
  if (text && embedding) {
    store.push({
      id: id++,
      text,
      embedding,
    })
  }
}

Bun.write(path.join(import.meta.dir, 'store.json'), JSON.stringify(store))
