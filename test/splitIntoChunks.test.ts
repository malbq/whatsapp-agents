import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { parsePdf } from '../packages/core/utils/parsePdf'
import { splitIntoChunks, splitIntoSentences } from '../packages/core/utils/splitIntoChunks'

test('Splits well formatted text into sentences', async () => {
  const original = `In these terms (the "Card Issuing Terms"), the following terms have the following meanings
(unless the context requires otherwise). All other capitalized terms shall have the meaning
given to them in the Definitions Schedule:
"Available Amount" means the balance in Cardholder's account;
"Card" means a Physical Card or Virtual Card as the context requires; "Card Details" has the
meaning given in Clause 5.1;`

  const expected = [
    'In these terms (the "Card Issuing Terms"), the following terms have the following meanings (unless the context requires otherwise).',
    'All other capitalized terms shall have the meaning given to them in the Definitions Schedule.',
    '"Available Amount" means the balance in Cardholder\'s account.',
    '"Card" means a Physical Card or Virtual Card as the context requires.',
    '"Card Details" has the meaning given in Clause 5.1.',
  ]

  const sentences = await splitIntoSentences(original)

  expect(sentences).toEqual(expected)
})

test('Splits large text into chunks', async () => {
  const original = `In these terms (the "Card Issuing Terms"), the following terms have the following meanings
unless the context requires otherwise All other capitalized terms shall have the meaning
given to them in the Definitions Schedule
Available Amount means the balance in Cardholder's account
Card means a Physical Card or Virtual Card as the context requires Card Details has the meaning given in Clause 5.1
In these terms (the "Card Issuing Terms"), the following terms have the following meanings
unless the context requires otherwise All other capitalized terms shall have the meaning
given to them in the Definitions Schedule
Available Amount means the balance in Cardholder's account
Card means a Physical Card or Virtual Card as the context requires Card Details has the meaning given in Clause 5.1
In these terms (the "Card Issuing Terms"), the following terms have the following meanings
unless the context requires otherwise All other capitalized terms shall have the meaning
given to them in the Definitions Schedule
Available Amount means the balance in Cardholder's account
Card means a Physical Card or Virtual Card as the context requires Card Details has the meaning given in Clause 5.1
In these terms (the "Card Issuing Terms"), the following terms have the following meanings
unless the context requires otherwise All other capitalized terms shall have the meaning
given to them in the Definitions Schedule
Available Amount means the balance in Cardholder's account
Card means a Physical Card or Virtual Card as the context requires Card Details has the meaning given in Clause 5.1
In these terms (the "Card Issuing Terms"), the following terms have the following meanings
unless the context requires otherwise All other capitalized terms shall have the meaning
given to them in the Definitions Schedule
Available Amount means the balance in Cardholder's account
Card means a Physical Card or Virtual Card as the context requires Card Details has the meaning given in Clause 5.1
In these terms (the "Card Issuing Terms"), the following terms have the following meanings
unless the context requires otherwise All other capitalized terms shall have the meaning
given to them in the Definitions Schedule
Available Amount means the balance in Cardholder's account
Card means a Physical Card or Virtual Card as the context requires Card Details has the meaning given in Clause 5.1`
  const expected = [
    `In these terms (the "Card Issuing Terms"), the following terms have the following meanings
unless the context requires otherwise All other capitalized terms shall have the meaning
given to them in the Definitions Schedule
Available Amount means the balance in Cardholder's account
Card means a Physical Card or Virtual Card as the context requires Card Details has the meaning given in Clause 5.1
In these terms (the "Card Issuing Terms"), the following terms have the following meanings
unless the context requires otherwise All other capitalized terms shall have the meaning
given to them in the Definitions Schedule
Available Amount means the balance in Cardholder's account
Card means a Physical Card or Virtual Card as the context requires Card Details has the meaning given in Clause 5.1
In these terms (the "Card Issuing Terms"), the following terms have the following meanings
unless the context requires otherwise All other capitalized terms shall have the meaning
given to them in the Definitions Schedule
Available Amount means the balance in Cardholder's account
Card means a Physical Card or Virtual Card as the context requires Card Details has the meaning given in Clause 5.1
In these terms (the "Card Issuing Terms"), the following terms have the following meanings
unless the context requires otherwise All other capitalized terms shall have the meaning
given to them in the Definitions Schedule
Available Amount means the balance in Cardholder's account
Card means a Physical Card or Virtual Card as the context requires Card Details has the meaning given in Clause 5.1
In these terms (the "Card Issuing Terms"), the following terms have the following meanings
unless the context requires otherwise All other capitalized terms shall have the meaning
given to them in the Definitions Schedule
Available Amount means the balance in Cardholder's account
Card means a Physical Card or Virtual Card as the context requires Card Details has the meaning given in Clause 5.1
In these terms`,
    `(the "Card Issuing Terms"), the following terms have the following meanings
unless the context requires otherwise All other capitalized terms shall have the meaning
given to them in the Definitions Schedule
Available Amount means the balance in Cardholder's account
Card means a Physical Card or Virtual Card as the context requires Card Details has the meaning given in Clause 5.1`,
  ]

  const sentences = await splitIntoChunks(original)

  expect(sentences).toHaveLength(expected.length)
})

test('Splits PDF document into chunks', async () => {
  const pdfBuffer = await Bun.file(
    join(import.meta.dir, '../eval/test/transcribeDocument.input.pdf')
  ).arrayBuffer()
  const text = await parsePdf(pdfBuffer)
  const chunks = await splitIntoChunks(text)
  expect(chunks.length).toEqual(Math.ceil(text.length / 2000))
})
