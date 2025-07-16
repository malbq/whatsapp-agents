import type { Response } from 'openai/resources/responses/responses'

export function printTokenUsage(response: Response) {
  if (!response.usage) return 'no token usage info'
  return `tokens: ${response.usage.total_tokens} = i:${response.usage.input_tokens} o:${response.usage.output_tokens}`
}
