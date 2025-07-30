import { describe, setDefaultTimeout } from 'bun:test'

setDefaultTimeout(30_000)

// TODO
describe.if(!!process.env.TEST_AI)('AI Respond', () => {})
