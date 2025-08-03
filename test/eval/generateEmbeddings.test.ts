import { describe, setDefaultTimeout } from 'bun:test'

setDefaultTimeout(30_000)

// TODO
describe.if(!!import.meta.env.TEST_AI)('Generate embeddings', () => {})
