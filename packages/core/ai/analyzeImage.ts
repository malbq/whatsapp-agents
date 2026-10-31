import { generateText, type LanguageModel, type LanguageModelUsage, type TextPart } from 'ai'

const IMAGE_ANALYSIS_TEMP = 0.1

export interface AnalyzeImageResult {
  text: string
  usage: LanguageModelUsage
}

export interface AnalyzeImage {
  (params: {
    instructions?: string
    imageUrl: string
    caption?: string
  }): Promise<AnalyzeImageResult>
}

export const defaultInstructions = `Provide a detailed description of this image in English suitable for semantic retrieval and text-based memory search.
If it is a photo or illustration without text, give only the description.
If there is any text present in the image, transcribe it accurately and try to reproduce in your response the same structure that the text has in the image.
# Guidelines
- Be concise yet detailed.
- If text is present, separate transcription from description.
- Visual elements like colors and positions are not as important as text and meaning.
- Description must have less than 2000 characters.
- Return only a concise description and transcribed text; no extra commentary or meta-information.`

export const createAnalyzeImage =
  ({ model }: { model: LanguageModel }): AnalyzeImage =>
  async ({ instructions = defaultInstructions, imageUrl, caption }) => {
    const result = await generateText({
      model,
      temperature: IMAGE_ANALYSIS_TEMP,
      instructions,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', image: imageUrl },
            ...(caption ? [{ type: 'text', text: caption } satisfies TextPart] : []),
          ],
        },
      ],
      telemetry: {
        functionId: 'analyzeImage',
        isEnabled: true,
      },
    })
    console.debug(`Image analyzed with ${result.response.modelId}`)
    return { text: result.text, usage: result.usage }
  }
