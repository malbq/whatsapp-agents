import { z } from 'zod'

const textResponseSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
})

const locationResponseSchema = z.object({
  type: z.literal('location'),
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  address: z.string().optional(),
})

const contactResponseSchema = z.object({
  type: z.literal('contact'),
  name: z.string(),
  phone: z.string(),
})

const interactiveResponseSchema = z
  .object({
    type: z.literal('interactive'),
    text: z.string().describe('Max 1024 characters. Exceeding this limit will be truncated.'),
    openListLabel: z
      .string()
      .describe(
        'Label of the button to open the list. Required if more than 3 options and ignored if less than or equal to 3 options. Max 20 characters. Exceeding this limit will be truncated.'
      )
      .default(''),
    options: z
      .array(z.string().describe('Max 20 characters. Exceeding this limit will be truncated.'))
      .describe('Array of options. Max 20 options. Exceeding this limit will be truncated.'),
  })
  .describe(
    'Interactive list of options. If less than 3 options, they are displayed below the message body. If more than 3 options, they are wrapped in a modal and `openListLabel` is required.'
  )

const whatsappResponseUnion = z.discriminatedUnion('type', [
  textResponseSchema,
  locationResponseSchema,
  contactResponseSchema,
  interactiveResponseSchema,
])

export const whatsappResponseSchema = z.object({
  message: whatsappResponseUnion,
})

export type WhatsappResponseSchema = z.infer<typeof whatsappResponseUnion>
