import { HttpError, type ToolExecutionError } from '@batman/core/errors'
import { tool } from 'ai'
import { ok } from 'node:assert'
import { z } from 'zod'
import { recordUsage } from '../systems/entitlements'

ok(import.meta.env.GOOGLE_PLACES_API_KEY, 'GOOGLE_PLACES_API_KEY is required')

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

const DEFAULT_MAX_RESULTS = 5

export const googlePlacesTool = tool({
  title: 'google_places',
  description: `Search for business and place information via Google Places.
Use when the user requests place discovery, addresses, hours, ratings, contact details, or "places near me" style queries.

This tool provides verified, structured data from Google Places including:
- Exact addresses and GPS coordinates
- Phone numbers and websites
- Business hours and ratings
- Current business status (operational, closed, etc.)

Examples of queries that this tool can handle:
- "Where is the nearest pizza place?"
- "What's the phone number for the nearest pizza place?"
- "Send me the location of the Eiffel Tower."
- "Send me the contact details of Bureau de Gustave Eiffel."`,
  inputSchema: z.object({
    query: z
      .string()
      .describe('The search query (e.g., "CPRO Dental Clinic Lisbon" or "pizza Rome")'),
    maxResults: z
      .number()
      .optional()
      .default(DEFAULT_MAX_RESULTS)
      .describe('Maximum number of results to return (1-20, default: 5)'),
  }),
  execute: async (params, { abortSignal }) => {
    const { query, maxResults = DEFAULT_MAX_RESULTS } = params

    try {
      // TODO how to fetch data localized to the user's language?
      const searchResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
        signal: abortSignal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': import.meta.env.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask':
            'places.displayName,' +
            'places.formattedAddress,' +
            'places.location,' +
            'places.internationalPhoneNumber,' +
            'places.websiteUri,' +
            'places.businessStatus,' +
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
        console.error('google_places API error', {
          ...params,
          error: new HttpError(searchResponse.status, searchResponse.statusText, errorText),
        })
        return {
          error: 'Tool execution failed',
          details: `Failed to search Google Places: [${searchResponse.status} ${searchResponse.statusText}] ${errorText}`,
        } satisfies ToolExecutionError
      }

      const { places = [] } = (await searchResponse.json()) as PlacesSearchResponse

      if (places.length === 0) {
        console.warn('google_places no results found', params)
        return `No places found for query: "${query}"`
      }

      console.info('google_places result', {
        result: places,
      })

      return places
    } catch (error) {
      console.error('google_places failed', {
        ...params,
        error,
      })
      return {
        error: 'Tool execution failed',
        details: error instanceof Error ? error.message : 'unknown',
      } satisfies ToolExecutionError
    } finally {
      recordUsage('n_google_places_calls_per_day', 1)
    }
  },
})
