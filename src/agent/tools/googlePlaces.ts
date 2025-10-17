import { getLogger } from '@logtape/logtape'
import { tool } from 'ai'
import { z } from 'zod'
import { spreadError } from '../../utils/spreadError'
import type { Frame } from '../frame'
import { toolUsageExplanation } from '../prompts/toolUsageExplanation'

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

export const googlePlacesTool = (frame: Frame, deps: Deps) =>
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

Set sendLocation/sendContact flags when:
- When the user explicitly wants a location/address/map (e.g., "where is X?", "send me the location of X", "how do I get to X?").
- When the user explicitly wants contact details (e.g., "what's the phone number for X?", "send me X's contact").
- Set both to false when the user is exploring options, asking general questions, or the request is ambiguous.

If a single match is found and flags are true, the location/contact will be sent automatically. If multiple matches exist, only the search results will be returned regardless of flags.`,
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
      explanation: z.string().describe(toolUsageExplanation),
    }),
    execute: async (params, { abortSignal }) => {
      const {
        query,
        maxResults = 5,
        sendLocation = false,
        sendContact = false,
        explanation,
      } = params

      const externalChatId = await deps.chat.sendText({ text: explanation })
      frame.outboundMessages.push({
        externalChatId,
        type: 'text',
        text: explanation,
      })

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
          logger.error('google_places: API error', {
            ...params,
            status: searchResponse.status,
            statusText: searchResponse.statusText,
            error: errorText,
          })
          return `Failed to search Google Places: [${searchResponse.status} ${searchResponse.statusText}] ${errorText}`
        }

        const { places = [] } = (await searchResponse.json()) as PlacesSearchResponse

        if (places.length === 0) {
          logger.warn('google_places: no results found', params)
          return `No places found for query: "${query}"`
        }

        const firstPlace = places[0]
        const hasSingleMatch = places.length === 1

        if (sendLocation && hasSingleMatch && firstPlace?.location) {
          const location = {
            latitude: firstPlace.location.latitude,
            longitude: firstPlace.location.longitude,
            name: firstPlace.displayName?.text,
            address: firstPlace.formattedAddress,
          }
          await deps.chat.sendLocation(location)
          logger.debug('google_places: sent location message', location)
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
          logger.debug('google_places: sent contact message', contact)
        }

        logger.info('google_places: completed', {
          ...params,
          resultsCount: places.length,
          sentLocation: sendLocation && hasSingleMatch && firstPlace?.location,
          sentContact: sendContact && hasSingleMatch && firstPlace?.internationalPhoneNumber,
        })
        logger.debug('google_places: results', { ...params, places })

        return JSON.stringify(places)
      } catch (error) {
        logger.error('google_places: unexpected error', {
          ...params,
          ...spreadError(error),
        })
        return `Error searching Google Places: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      }
    },
  })
