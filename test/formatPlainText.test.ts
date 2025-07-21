import chalk from 'chalk'
import { splitIntoSentences } from '../src/utils/formatPlainText'

const original = `In these terms (the “Card Issuing Terms”), the following terms have the following meanings
(unless the context requires otherwise). All other capitalized terms shall have the meaning
given to them in the Definitions Schedule:

"Available Amount" means the balance in Cardholder's account;

"Card" means a Physical Card or Virtual Card as the context requires; “Card Details" has the
meaning given in Clause 5.1;`

const expected = [
  'In these terms (the "Card Issuing Terms"), the following terms have the following meanings (unless the context requires otherwise).',
  'All other capitalized terms shall have the meaning given to them in the Definitions Schedule: "Available Amount" means the balance in Cardholder\'s account.',
  '"Card" means a Physical Card or Virtual Card as the context requires.',
  '"Card Details" has the meaning given in Clause 5.1.',
]

const sentences = await splitIntoSentences(original)
if (sentences.length !== expected.length) {
  console.error(
    `Sentences length mismatch: actual ${sentences.length} expected ${expected.length}`
  )
}

expected.forEach((e, i) => {
  if (sentences[i] === e) {
    console.log(chalk.green(e))
    return
  }
  console.log(chalk.red(`expect: ${e}\nactual: ${sentences[i]}`))
})
