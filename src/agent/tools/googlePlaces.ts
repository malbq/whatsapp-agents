import { getLogger } from '@logtape/logtape'
import { tool } from 'ai'
import { z } from 'zod'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'tool', 'googlePlaces'])

const GOOGLE_PLACES_API_KEY = import.meta.env.GOOGLE_PLACES_API_KEY

interface PlaceResult {
  name: string
  formattedAddress: string
  location: {
    latitude: number
    longitude: number
  }
  rating?: number
  userRatingCount?: number
  phoneNumber?: string
  internationalPhoneNumber?: string
  website?: string
  businessStatus?: string
  types?: string[]
  openingHours?: {
    openNow?: boolean
    weekdayText?: string[]
  }
}

export const googlePlacesTool = (_frame: Frame, _deps: Deps) =>
  tool({
    name: 'google_places',
    description: `Search for business locations using Google Places API.
Use this tool when the user asks about:
- Finding a specific business or place
- Getting contact details (phone, website) for a business
- Finding the address or location of a business
- Getting business hours or ratings
- Finding places near a location
- Discovering businesses by category (restaurants, hotels, etc.)

This tool provides verified, structured data from Google's Places database including:
- Exact addresses and GPS coordinates
- Phone numbers and websites
- Business hours and ratings
- Current business status (operational, closed, etc.)

Follow-up actions:
- If you are confident a single result matches the user's request, immediately call send_location with latitude, longitude, name, and formatted address.
- If a phone number is available, also call send_contact with the place name and the international phone number.
- If there are multiple plausible matches, present the top 3 concise options and ask the user to pick before calling these tools.
- Do not call these tools if you are unsure about the match.`,
    inputSchema: z.object({
      query: z
        .string()
        .describe('The search query (e.g., "CPRO Dental Clinic Lisbon" or "pizza Rome")'),
      maxResults: z
        .number()
        .optional()
        .default(5)
        .describe('Maximum number of results to return (1-20, default: 5)'),
    }),
    execute: async ({ query, maxResults = 5 }) => {
      if (!GOOGLE_PLACES_API_KEY) {
        logger.error('Google Places API key not configured')
        return 'Google Places search is not configured. Please set GOOGLE_PLACES_API_KEY environment variable.'
      }

      logger.info(`Google Places search: ${query}`, { maxResults })

      try {
        const searchUrl = 'https://places.googleapis.com/v1/places:searchText'

        const searchResponse = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask':
              'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.businessStatus,places.types,places.currentOpeningHours,places.id',
          },
          body: JSON.stringify({
            textQuery: query,
            maxResultCount: Math.min(Math.max(maxResults, 1), 20),
          }),
        })

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text()
          logger.error('Google Places API error', {
            status: searchResponse.status,
            statusText: searchResponse.statusText,
            error: errorText,
          })
          return `Failed to search Google Places: ${searchResponse.status} ${searchResponse.statusText}`
        }

        const searchData = (await searchResponse.json()) as { places?: any[] }
        const places = searchData.places || []

        logger.info(`Found ${places.length} places`, {
          query,
          count: places.length,
        })

        if (places.length === 0) {
          return `No places found for query: "${query}"`
        }

        // Format results
        const results: PlaceResult[] = places.map((place: any) => ({
          name: place.displayName?.text || 'Unknown',
          formattedAddress: place.formattedAddress || 'Address not available',
          location: {
            latitude: place.location?.latitude || 0,
            longitude: place.location?.longitude || 0,
          },
          rating: place.rating,
          userRatingCount: place.userRatingCount,
          phoneNumber: place.nationalPhoneNumber,
          internationalPhoneNumber: place.internationalPhoneNumber,
          website: place.websiteUri,
          businessStatus: place.businessStatus,
          types: place.types,
          openingHours: place.currentOpeningHours
            ? {
                openNow: place.currentOpeningHours.openNow,
                weekdayText: place.currentOpeningHours.weekdayDescriptions,
              }
            : undefined,
        }))

        logger.debug('Places found', { results })

        // Return formatted results
        return results
          .map((place, index) => {
            const parts = [
              `${index + 1}. **${place.name}**`,
              `   Address: ${place.formattedAddress}`,
              `   Coordinates: ${place.location.latitude}, ${place.location.longitude}`,
            ]

            if (place.phoneNumber) {
              parts.push(`   Phone: ${place.phoneNumber}`)
            }
            if (
              place.internationalPhoneNumber &&
              place.internationalPhoneNumber !== place.phoneNumber
            ) {
              parts.push(`   International: ${place.internationalPhoneNumber}`)
            }
            if (place.website) {
              parts.push(`   Website: ${place.website}`)
            }
            if (place.rating) {
              parts.push(`   Rating: ${place.rating}/5 (${place.userRatingCount || 0} reviews)`)
            }
            if (place.businessStatus) {
              parts.push(`   Status: ${place.businessStatus}`)
            }
            if (place.openingHours?.openNow !== undefined) {
              parts.push(`   Currently: ${place.openingHours.openNow ? 'OPEN' : 'CLOSED'}`)
            }
            if (place.types && place.types.length > 0) {
              parts.push(`   Type: ${place.types.slice(0, 3).join(', ')}`)
            }

            return parts.join('\n')
          })
          .join('\n\n')
      } catch (error) {
        logger.error('Google Places search failed', { error })
        return `Error searching Google Places: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      }
    },
  })
