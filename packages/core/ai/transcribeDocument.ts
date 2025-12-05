import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'
import { ok } from 'node:assert'

ok(import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY, 'GOOGLE_GENERATIVE_AI_API_KEY is required')

const googleProvider = createGoogleGenerativeAI()
const documentTranscriptionModel = googleProvider('gemini-2.5-flash-lite')

export interface TranscribeDocument {
  (params: {
    instructions?: string
    document: ArrayBuffer
    mimeType: string
    filename: string
  }): Promise<string>
}

export const defaultInstructions = `Extract the complete text content from the provided document while preserving its structure and meaning. Do not summarize, rephrase, or omit any information from the original document. Do not apply stylistic or decorative formatting such as markdown, HTML, or typographic emphasis.
  Apply only minimal plain-text formatting to ensure the output is readable and logically arranged:
  - Correct inconsistencies in quotation marks (use straight quotes: " and ').
  - Fix line breaks that split sentences incorrectly, joining lines when a line break occurs in the middle of a sentence.
  - Remove sequences of more than two consecutive empty lines, reducing them to a maximum of one.
  - Otherwise, retain the original paragraph and section separation to preserve logical structure.
  # Output Format
  Return the result as a single plain text block, formatted according to the above rules. No markdown, or special formatting allowed.
  # Notes
  - Do not add introductions, conclusions, or commentary.
  - The extracted text should faithfully represent the source without added style, but may be adjusted for baseline readability (as per rules above).`

export const transcribeDocument: TranscribeDocument = async ({
  instructions = defaultInstructions,
  document,
  mimeType,
  filename,
}) => {
  const copy = document.slice(0)
  const result = await generateText({
    model: documentTranscriptionModel,
    temperature: 0,
    system: instructions,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'file',
            data: copy,
            mediaType: mimeType,
            filename,
          },
        ],
      },
    ],
    experimental_telemetry: {
      functionId: 'transcribeDocument',
      isEnabled: true,
    },
  })
  console.debug(
    `Document transcribed with ${documentTranscriptionModel.provider}/${documentTranscriptionModel.modelId}`
  )
  return result.text
}
