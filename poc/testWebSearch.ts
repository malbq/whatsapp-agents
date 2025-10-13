/**
 * Web Search Tool Example
 * 
 * This standalone script demonstrates the web_search tool functionality
 * using Gemini 2.5 Flash with Google Search grounding.
 * 
 * USAGE:
 *   bun run poc/testWebSearch.ts "your search query" [--urls]
 * 
 * EXAMPLES:
 *   bun run poc/testWebSearch.ts "latest AI news"
 *   bun run poc/testWebSearch.ts "weather in Lisbon" --urls
 *   bun run poc/testWebSearch.ts  # runs default examples
 * 
 * REQUIREMENTS:
 * - GOOGLE_AI_STUDIO_API_KEY environment variable must be set
 * - CF_ACCOUNT_ID, CF_GATEWAY_ID, CF_API_TOKEN for Cloudflare AI Gateway
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'

const gatewayBaseURL = `https://gateway.ai.cloudflare.com/v1/${process.env.CF_ACCOUNT_ID}/${process.env.CF_GATEWAY_ID}`

const google = createGoogleGenerativeAI({
  baseURL: `${gatewayBaseURL}/google-ai-studio/v1beta`,
  apiKey: process.env.GOOGLE_AI_STUDIO_API_KEY || '',
  headers: { 'cf-aig-authorization': `Bearer ${process.env.CF_API_TOKEN}` },
})

const model = google('gemini-2.5-flash')

async function webSearch(query: string, includeUrls = false) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🔍 Web Search: ${query}`)
  console.log(`   Include URLs: ${includeUrls}`)
  console.log('='.repeat(80))

  const systemPrompt = `You are a web search assistant. Search the web for information about the user's query and provide a comprehensive, accurate answer.

${includeUrls ? 'IMPORTANT: At the end of your answer, include a "Sources:" section with a numbered list of URLs you used.' : ''}

Format your answer to be:
- Clear and concise
- Factual and accurate
- Well-structured with relevant details
- Based on current, reliable sources

If you cannot find relevant information, state that clearly.`

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: query,
    tools: {
      google_search: google.tools.googleSearch({}),
    },
  })

  console.log('\n📝 ANSWER:\n')
  console.log(result.text)

  // Extract URLs from grounding chunks if available and includeUrls is true
  const groundingMetadata = result.providerMetadata?.google?.groundingMetadata as any
  
  if (includeUrls && groundingMetadata?.groundingChunks) {
    const urls = groundingMetadata.groundingChunks
      .filter((chunk: any) => chunk.web?.uri)
      .map((chunk: any) => chunk.web.uri)
      .filter((url: string, index: number, self: string[]) => self.indexOf(url) === index)

    if (urls.length > 0) {
      console.log('\n\n🔗 SOURCES:\n')
      urls.forEach((url: string, i: number) => {
        console.log(`${i + 1}. ${url}`)
      })
    }
  }

  console.log('\n\n📊 Metadata:')
  console.log('  Usage:', result.usage)
  console.log('  Steps:', result.steps?.length || 0)
  
  if (groundingMetadata?.webSearchQueries) {
    console.log('  Web searches performed:', groundingMetadata.webSearchQueries.length)
    console.log('  Queries:', groundingMetadata.webSearchQueries)
  }

  return result.text
}

async function main() {
  console.log('🚀 Web Search Tool Example - Gemini 2.5 Flash + Google Search\n')

  const args = process.argv.slice(2)
  
  let queries: Array<{ query: string; includeUrls: boolean }>
  
  if (args.length >= 1 && !args[0]!.startsWith('--')) {
    // Use CLI arguments
    const query = args[0]!
    const includeUrls = args.includes('--urls')
    queries = [{ query, includeUrls }]
    console.log('📋 Using CLI arguments\n')
  } else {
    // Use default test cases
    console.log('📋 No query provided. Running default examples.')
    console.log('💡 Usage: bun run poc/testWebSearch.ts "your query" [--urls]\n')
    
    queries = [
      { query: 'What are the latest developments in AI?', includeUrls: false },
      { query: 'Best practices for TypeScript in 2025', includeUrls: true },
      { query: 'Current weather in Lisbon Portugal', includeUrls: false },
    ]
  }

  for (const { query, includeUrls } of queries) {
    try {
      await webSearch(query, includeUrls)
    } catch (error) {
      console.error(`\n❌ Error searching "${query}":`, error)
    }
    
    // Add delay between queries to avoid rate limiting
    if (queries.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('✅ Completed')
}

main().catch(console.error)
