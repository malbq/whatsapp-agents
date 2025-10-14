import { getLogger } from '@logtape/logtape'
import { tool } from 'ai'
import { z } from 'zod'
import { spreadError } from '../../utils/spreadError'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'tool', 'googlePlaces'])

interface PlacesSearchResponse {
  places?: GooglePlace[]
}

interface GooglePlace {
  displayName?: {
    text: string
    languageCode?: string
  }
  formattedAddress?: string
  location?: {
    latitude: number
    longitude: number
  }
  rating?: number
  userRatingCount?: number
  internationalPhoneNumber?: string
  websiteUri?: string
  businessStatus?: string
  types?: string[]
  currentOpeningHours?: {
    openNow?: boolean
    weekdayDescriptions?: string[]
    nextOpenTime?: string
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
      try {
        const searchUrl = 'https://places.googleapis.com/v1/places:searchText'

        const searchResponse = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': import.meta.env.GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask':
              'places.displayName,' +
              'places.formattedAddress,' +
              'places.location,' +
              'places.rating,' +
              'places.userRatingCount,' +
              'places.internationalPhoneNumber,' +
              'places.websiteUri,' +
              'places.businessStatus,' +
              'places.types,' +
              'places.currentOpeningHours.openNow,' +
              'places.currentOpeningHours.weekdayDescriptions,' +
              'places.currentOpeningHours.nextOpenTime',
          },
          body: JSON.stringify({
            textQuery: query,
            maxResultCount: Math.min(Math.max(maxResults, 1), 20),
          }),
        })

        if (!searchResponse.ok) {
          const errorText = await searchResponse.text()
          logger.error('Places API error', {
            status: searchResponse.status,
            statusText: searchResponse.statusText,
            error: errorText,
          })
          return `Failed to search Google Places: [${searchResponse.status} ${searchResponse.statusText}] ${errorText}`
        }

        const response = (await searchResponse.json()) as PlacesSearchResponse
        const places = response.places || []

        logger.info(`Places search`, { query, maxResults, resultsCount: places.length })
        logger.debug('Google Places response', { response })

        if (places.length === 0) {
          return `No places found for query: "${query}"`
        }

        return JSON.stringify(places)
      } catch (error) {
        logger.error('Places search failed', spreadError(error))
        return `Error searching Google Places: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      }
    },
  })
