import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, type TextPart } from 'ai'

const googleProvider = createGoogleGenerativeAI()
const imageAnalysisModel = googleProvider('gemini-2.5-flash')
const IMAGE_ANALYSIS_TEMP = 0.1

export interface AnalyzeImage {
  (params: { instructions?: string; imageUrl: string; caption?: string }): Promise<string>
}

export const defaultInstructions = `Provide a detailed description of this image in English.
If it is a photo or illustration without text, give only the description.
If there is any text present in the image, transcribe it accurately and try to reproduce in your response the same structure that the text has in the image.
# Guidelines
- Be concise yet detailed.
- If text is present, separate transcription from description.
- Visual elements like colors and positions are not as important as text and meaning.
- Description must have less than 2000 characters.`

export const analyzeImage: AnalyzeImage = async ({
  instructions = defaultInstructions,
  imageUrl,
  caption,
}) => {
  const result = await generateText({
    model: imageAnalysisModel,
    temperature: IMAGE_ANALYSIS_TEMP,
    system: instructions,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', image: imageUrl },
          ...(caption ? [{ type: 'text', text: caption } satisfies TextPart] : []),
        ],
      },
    ],
  })
  console.debug(`Image analyzed with ${imageAnalysisModel.modelId}`, {
    gatewayLogId: result.response.headers?.['cf-aig-log-id'],
    totalUsage: result.totalUsage,
    steps: result.steps.map(({ request: _, response: __, ...step }) => {
      return step
    }),
  })
  return result.text
}
