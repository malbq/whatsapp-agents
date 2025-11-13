import type { ToolExecutionError } from '@batman/core/errors'
import { spreadError } from '@batman/core/utils/spreadError'
import { toAssistantModelMessage } from '@batman/core/utils/toModelMessage'
import type { LocationMessage } from '@batman/whatsapp'
import { tool } from 'ai'
import { z } from 'zod'

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

interface GooglePlacesDeps {
  chat: {
    sendText: (params: { text: string }) => Promise<string>
    sendLocation: (params: {
      latitude: number
      longitude: number
      name?: string
      address?: string
    }) => Promise<void>
    sendContact: (params: { name: string; phone: string }) => Promise<void>
  }
}

export const googlePlacesTool = (deps: GooglePlacesDeps) =>
  tool({
    title: 'google_places',
    description: `Search for business and place information via Google Places.
Use when the user requests place discovery, addresses, hours, ratings, contact details, or "places near me" style queries.

This tool provides verified, structured data from Google Places including:
- Exact addresses and GPS coordinates
- Phone numbers and websites
- Business hours and ratings
- Current business status (operational, closed, etc.)

Set sendLocation/sendContact flags when:
- When the user explicitly wants a location/address/map (e.g., "where is X?", "send me the location of X", "how do I get to X?").
- When the user explicitly wants contact details (e.g., "what's the phone number for X?", "send me X's contact").
- Set both to false when the user is exploring options, asking general questions, or the request is ambiguous.

If a single match is found and flags are true, the location/contact will be sent automatically.
If multiple matches exist, only the search results will be returned regardless of flags.`,
    inputSchema: z.object({
      query: z
        .string()
        .describe('The search query (e.g., "CPRO Dental Clinic Lisbon" or "pizza Rome")'),
      maxResults: z
        .number()
        .optional()
        .default(5)
        .describe('Maximum number of results to return (1-20, default: 5)'),
      sendLocation: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'Set to true if the user explicitly requests a location, address, or map. The tool will send a map pin only if exactly one result is found.'
        ),
      sendContact: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          'Set to true if the user explicitly requests contact details or phone number. The tool will send a contact card only if exactly one result is found and has a phone number.'
        ),
    }),
    execute: async (params, { abortSignal, messages }) => {
      const { query, maxResults = 5, sendLocation = false, sendContact = false } = params

      try {
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
          console.error('API error', {
            ...params,
            status: searchResponse.status,
            statusText: searchResponse.statusText,
            error: errorText,
          })
          return `Failed to search Google Places: [${searchResponse.status} ${searchResponse.statusText}] ${errorText}`
        }

        const { places = [] } = (await searchResponse.json()) as PlacesSearchResponse

        if (places.length === 0) {
          console.warn('no results found', params)
          return `No places found for query: "${query}"`
        }

        const firstPlace = places[0]
        const hasSingleMatch = places.length === 1

        if (sendLocation && hasSingleMatch && firstPlace?.location) {
          const location: LocationMessage = {
            type: 'location',
            latitude: firstPlace.location.latitude,
            longitude: firstPlace.location.longitude,
            name: firstPlace.displayName?.text,
            address: firstPlace.formattedAddress,
          }
          const locationMessageId = await deps.chat.sendLocation(location)
          messages.push(toAssistantModelMessage(location)!)
          console.debug('sent location message', location)
        }

        if (
          sendContact &&
          hasSingleMatch &&
          firstPlace?.internationalPhoneNumber &&
          firstPlace?.displayName?.text
        ) {
          const contact = {
            name: firstPlace.displayName.text,
            phone: firstPlace.internationalPhoneNumber,
          }
          await deps.chat.sendContact(contact)
          console.debug('sent contact message', contact)
        }

        console.log('completed', {
          ...params,
          resultsCount: places.length,
          sentLocation: sendLocation && hasSingleMatch && firstPlace?.location,
          sentContact: sendContact && hasSingleMatch && firstPlace?.internationalPhoneNumber,
        })
        console.debug('results', { ...params, places })

        return JSON.stringify(places)
      } catch (error) {
        console.error('Tool execution failed', {
          ...params,
          ...spreadError(error),
        })
        return {
          error: 'Tool execution failed',
          details: error instanceof Error ? error.message : 'unknown',
        } satisfies ToolExecutionError
      }
    },
  })
