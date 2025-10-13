/**
 * Business Locator Script - Gemini 2.5 Flash + Google Search + WhatsApp Detection
 * 
 * This standalone script uses Google's Gemini 2.5 Flash model with Google Search grounding
 * to find detailed business information including location, contact details, and WhatsApp availability.
 * 
 * FEATURES:
 * - Business name + city search
 * - Complete address extraction
 * - GPS coordinates (when available)
 * - Phone numbers (main line, mobile, WhatsApp)
 * - Email addresses
 * - Website URLs
 * - WhatsApp availability detection (based on web mentions, not API verification)
 * 
 * USAGE:
 *   bun run script/testGeminiSearch.ts "Business Name" "City" ["Country"]
 * 
 * EXAMPLES:
 *   bun run script/testGeminiSearch.ts "Café A Brasileira" "Lisbon" "Portugal"
 *   bun run script/testGeminiSearch.ts "Apple Store" "New York"
 *   bun run script/testGeminiSearch.ts  # runs default test cases
 * 
 * WHATSAPP DETECTION:
 * The script detects WhatsApp availability by:
 * 1. Looking for explicit "WhatsApp:" mentions in search results
 * 2. Finding wa.me/ links on business websites
 * 3. Detecting WhatsApp-related keywords near phone numbers
 * 
 * NOTE: This does NOT use WhatsApp Business API to verify numbers (to avoid sending messages).
 * For production WhatsApp verification, you would need to:
 * - Use the WhatsApp Business API contacts endpoint
 * - Or check for wa.me/ links on the business website
 * - Or look for the official WhatsApp Business verification badge
 * 
 * REQUIREMENTS:
 * - GOOGLE_AI_STUDIO_API_KEY environment variable must be set
 * 
 * @author zapid team
 * @date 2025-10-11
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText } from 'ai'

// Setup Gemini with Google Search tool
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_STUDIO_API_KEY || '',
})

const model = google('gemini-2.5-flash')

const SYSTEM_PROMPT = `You are a precise business information assistant. Your task is to find exact contact and location details for businesses.

When searching for a business, you MUST provide:
1. **Complete Address**: Full street address including street name, number, postal code, city, and country
2. **GPS Coordinates**: Latitude and longitude in decimal format (e.g., 38.7223, -9.1393)
3. **Phone Numbers**: All available phone numbers (main line, WhatsApp, mobile). If a phone number is explicitly mentioned as WhatsApp or has a WhatsApp link, mark it clearly with "WhatsApp:" label.
4. **Email**: Primary contact email address
5. **Website**: Official website URL if available

Format your response as a structured list with clear labels. If you cannot find specific information (e.g., coordinates or email), explicitly state "Not found" for that field.

Be thorough and search multiple sources to ensure accuracy. If you find multiple locations for the same business, list them all separately.

IMPORTANT: When you find phone numbers, check if the business explicitly mentions WhatsApp availability. Look for:
- "WhatsApp:" followed by a number
- "Contact us via WhatsApp" mentions  
- wa.me/ links
- WhatsApp icons or buttons on their website
- Explicitly label any phone number that is confirmed to have WhatsApp with "WhatsApp:" prefix`

interface BusinessQuery {
  businessName: string
  city: string
  country?: string
}

/**
 * Alternative: Check if the business mentions WhatsApp in the AI response
 */
function checkWhatsAppMentions(responseText: string, phoneNumber: string): boolean {
  const cleanPhone = phoneNumber.replace(/[\s\-()+]/g, '')
  
  // Check if this specific phone appears near WhatsApp mentions
  const phoneContext = responseText.toLowerCase()
  const phoneVariants = [
    phoneNumber,
    cleanPhone,
    phoneNumber.replace(/\+/g, ''),
  ]
  
  for (const variant of phoneVariants) {
    // Look for WhatsApp mentioned within 50 characters of the phone number
    const phoneIndex = phoneContext.indexOf(variant.toLowerCase())
    if (phoneIndex !== -1) {
      const contextStart = Math.max(0, phoneIndex - 50)
      const contextEnd = Math.min(phoneContext.length, phoneIndex + variant.length + 50)
      const context = phoneContext.substring(contextStart, contextEnd)
      
      if (context.includes('whatsapp') || context.includes('wa.me') || context.includes('wapp')) {
        return true
      }
    }
  }
  
  return false
}

/**
 * Parse phone numbers from AI response
 */
function parsePhoneNumbers(responseText: string): string[] {
  // Match international phone numbers with various formats
  const phoneRegex = /\+?\d{1,3}[\s-]?\(?\d{2,3}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/g
  const matches = responseText.match(phoneRegex) || []
  
  // Filter out common false positives (like coordinates, dates, etc.)
  const validNumbers = matches.filter(match => {
    const digitsOnly = match.replace(/\D/g, '')
    return digitsOnly.length >= 8 && digitsOnly.length <= 15
  })
  
  return [...new Set(validNumbers)] // Remove duplicates
}

async function searchBusiness({ businessName, city, country }: BusinessQuery) {
  const location = country ? `${city}, ${country}` : city
  const query = `Find exact contact details for "${businessName}" in ${location}. Include WhatsApp numbers if available.`
  
  console.log(`\n${'='.repeat(80)}`)
  console.log(`🔍 Searching: ${businessName} in ${location}`)
  console.log('='.repeat(80))
  
  const result = await generateText({
    model,
    system: SYSTEM_PROMPT,
    prompt: query,
    tools: {
      google_search: google.tools.googleSearch({}),
    },
  })

  console.log('\n📍 BUSINESS INFORMATION:\n')
  console.log(result.text)
  
  // Extract and check WhatsApp status for phone numbers
  const phoneNumbers = parsePhoneNumbers(result.text)
  
  if (phoneNumbers.length > 0) {
    console.log('\n\n📱 WhatsApp Status Analysis:\n')
    
    for (const phone of phoneNumbers) {
      const mentionedAsWhatsApp = checkWhatsAppMentions(result.text, phone)
      
      if (mentionedAsWhatsApp) {
        console.log(`  ${phone}: ✅ HAS WHATSAPP (mentioned in business info)`)
      } else {
        console.log(`  ${phone}: ❓ Not verified (check business website for wa.me links)`)
      }
    }
    
    console.log('\n  💡 Tip: Look for "WhatsApp:" labels in the business info above')
    console.log('     or visit the business website to find wa.me/ click-to-chat links')
  }
  
  console.log('\n\n📊 Metadata:')
  console.log('  Usage:', result.usage)
  console.log('  Steps:', result.steps?.length || 0)
  
  // Check grounding metadata for search queries
  const groundingMetadata = result.providerMetadata?.google?.groundingMetadata as any
  if (groundingMetadata?.webSearchQueries) {
    console.log('  Web searches performed:', groundingMetadata.webSearchQueries.length)
  }

  return result.text
}

async function main() {
  console.log('🚀 Business Locator - Gemini 2.5 Flash + Google Search + WhatsApp Detection\n')

  // Parse CLI arguments
  const args = process.argv.slice(2)
  
  let businesses: BusinessQuery[]
  
  if (args.length >= 2) {
    // Use CLI arguments: bun run script/testGeminiSearch.ts "Business Name" "City" ["Country"]
    businesses = [{
      businessName: args[0]!,
      city: args[1]!,
      country: args[2],
    }]
    console.log('📋 Using CLI arguments\n')
  } else {
    // Use default test cases
    console.log('📋 No arguments provided. Running default test cases.')
    console.log('💡 Usage: bun run script/testGeminiSearch.ts "Business Name" "City" ["Country"]\n')
    
    businesses = [
      { businessName: 'CPRO Dental Clinic', city: 'Lisbon', country: 'Portugal' },
      { businessName: 'Pizzeria Da Baffetto', city: 'Rome', country: 'Italy' },
    ]
  }

  for (const business of businesses) {
    try {
      await searchBusiness(business)
    } catch (error) {
      console.error(`\n❌ Error searching ${business.businessName}:`, error)
    }
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('✅ Completed')
  console.log('\n📝 About WhatsApp Verification:')
  console.log('   - Gemini searches for explicit WhatsApp mentions on business websites')
  console.log('   - Look for wa.me/ links or "WhatsApp" labels in the results')
  console.log('   - For API-based verification, you would need to send actual WhatsApp')
  console.log('     messages, which is not recommended for discovery purposes')
}

main().catch(console.error)
