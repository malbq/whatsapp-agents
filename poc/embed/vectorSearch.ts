import { type Vector } from './createVectorStore'
import { generateEmbeddings } from './generateEmbeddings'
import storeJson from './store.json'
const store = storeJson as Vector[]

interface SearchResult extends Vector {
  score: number
}

function search(queryEmbedding: number[], topK: number): SearchResult[] {
  return store
    .map<SearchResult>((vector) => ({
      ...vector,
      score: calcSimilarity(queryEmbedding, vector.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

function calcSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0,
    magnitudeA = 0,
    magnitudeB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!
    magnitudeA += a[i]! * a[i]!
    magnitudeB += b[i]! * b[i]!
  }
  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
}

const input = 'quais os meus agendamentos?'
const inputEmbedding =
  (await generateEmbeddings(input).then((embeddings) => embeddings[0])) ?? []
const results = search(inputEmbedding, 10)
console.log(`Query: ${input}`)
console.table(
  results.map((result) => ({
    text: result.text,
    similarity: result.score.toFixed(5),
  }))
)
