import { getLogger } from '@logtape/logtape'
import { tool } from 'ai'
import { z } from 'zod'
import type { Frame } from '../frame'

const logger = getLogger(['app', 'agent', 'tool', 'sendContact'])

export const sendContactTool = (frame: Frame, deps: Deps) =>
  tool({
    name: 'send_contact',
    description:
      'Send a contact card to the user. Use this to share business contacts found via google_places or share contact information.',
    inputSchema: z.object({
      name: z.string().describe('Contact name'),
      phone: z
        .string()
        .describe(
          'Contact phone number in the format {country_code}{phone_number} (e.g., 1234567890 for US, 441234567890 for UK, 551187654321 for Brazil)'
        ),
    }),
    execute: async ({ name, phone }) => {
      await deps.chat.sendContact({ name, phone })
      logger.debug(
        `Sent contact ${name} (${phone}) to ${frame.user!.name} (${frame.user!.externalId})`
      )
      return `Sent contact card for ${name} to user`
    },
  })
