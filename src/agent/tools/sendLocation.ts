import { getLogger } from '@logtape/logtape'
import { tool } from 'ai'
import { z } from 'zod'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'tool', 'sendLocation'])

export const sendLocationTool = (frame: Frame, deps: Deps) =>
  tool({
    name: 'send_location',
    description:
      'Send a location/map pin to the user. Use right after google_places when a single business match is confident. Include name and formatted address when available.',
    inputSchema: z.object({
      latitude: z.number().describe('Latitude coordinate'),
      longitude: z.number().describe('Longitude coordinate'),
      name: z.string().optional().describe('Optional name of the location (e.g., business name)'),
      address: z.string().optional().describe('Optional street address'),
    }),
    execute: async ({ latitude, longitude, name, address }) => {
      await deps.chat.sendLocation({
        latitude,
        longitude,
        name,
        address,
        replyingTo: frame.inbound?.externalChatId,
      })
      logger.debug(
        `Sent location (${latitude}, ${longitude}) ${name ? `"${name}"` : ''} to ${
          frame.user!.name
        } (${frame.user!.externalId})`
      )
      return 'Location sent to user'
    },
  })
