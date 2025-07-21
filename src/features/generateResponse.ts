export async function generateResponse(
  { ai }: Deps,
  message: string
): Promise<string> {
  return await ai.respond({ input: message })
}
