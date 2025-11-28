import { z } from 'zod'

export const textMessageSchema = z
  .object({
    type: z.literal('text'),
    text: z.string(),
  })
  .describe(
    'Default and primary response type. Prefer this in most situations. If uncertain about which type to use, respond with a text message.'
  )

export const voiceMessageSchema = z.object({
  type: z.literal('voice'),
  data: z.instanceof(ArrayBuffer), // FIXME: LLM does not know about ArrayBuffer
  mimeType: z.string(),
})

export const audioMessageSchema = z.object({
  type: z.literal('audio'),
  data: z.instanceof(ArrayBuffer), // FIXME: LLM does not know about ArrayBuffer
  mimeType: z.string(),
})

export const incomingDocumentMessageSchema = z.object({
  type: z.literal('document'),
  data: z.instanceof(ArrayBuffer),
  mimeType: z.string(),
  filename: z.string(),
  caption: z.string().optional(),
})

export const incomingImageMessageSchema = z.object({
  type: z.literal('image'),
  data: z.instanceof(ArrayBuffer),
  mimeType: z.string(),
  caption: z.string().optional(),
})

export const outgoingDocumentMessageSchema = z
  .object({
    type: z.literal('document'),
    resourceId: z.string(),
    caption: z
      .string()
      .optional()
      .describe('Max 1024 characters. Exceeding this limit will be truncated.'),
  })
  .describe('Deliver a document to the user. Only call this after using `search_files` tool.')

export const outgoingImageMessageSchema = z
  .object({
    type: z.literal('image'),
    resourceId: z.string(),
    caption: z
      .string()
      .optional()
      .describe('Max 1024 characters. Exceeding this limit will be truncated.'),
  })
  .describe('Deliver an image to the user. Only call this after using `search_files` tool.')

export const locationMessageSchema = z
  .object({
    type: z.literal('location'),
    latitude: z.number(),
    longitude: z.number(),
    name: z.string().optional(),
    address: z.string().optional(),
  })
  .describe('Use to share a place or business location address or coordinates.')

export const contactMessageSchema = z
  .object({
    type: z.literal('contact'),
    name: z.string(),
    phone: z.string(),
  })
  .describe('Use to share contact details like phone number or name.')

export const reactionMessageSchema = z.object({
  type: z.literal('reaction'),
  emoji: z.string(),
  targetMessageId: z.string(),
})

export const interactiveListMessageSchema = z
  .object({
    type: z.literal('interactive_list'),
    header: z
      .string()
      .describe(
        'Default: omit. Only include if essential to disambiguate or add critical context. Max 60 characters. Exceeding this limit will be truncated.'
      )
      .optional(),
    body: z.string().describe('Max 4096 characters. Exceeding this limit will be truncated.'),
    footer: z
      .string()
      .describe(
        'Default: omit. Only include if essential to disambiguate or add critical context. Max 60 characters. Exceeding this limit will be truncated.'
      )
      .optional(),
    openListButton: z
      .string()
      .describe(
        'Label of the button to open the list. Max 20 characters. Exceeding this limit will be truncated.'
      ),
    sections: z
      .array(
        z.object({
          title: z
            .string()
            .describe('Section title. Max 24 characters. Exceeding this limit will be truncated.')
            .optional(),
          options: z.array(
            z.object({
              title: z
                .string()
                .describe(
                  'Option title. Max 24 characters. Exceeding this limit will be truncated.'
                ),
              description: z
                .string()
                .describe(
                  'Option description. Default: omit. Only include if essential to disambiguate similar titles; never repeat the title. Max 72 characters. Exceeding this limit will be truncated.'
                )
                .optional(),
            })
          ),
        })
      )
      .describe(
        'Array of sections. Max 10 options total across all sections. Exceeding this limit will be truncated.'
      ),
  })
  .describe(
    'Interactive list message with sections and options. Use this when you have more than 3 options or need to organize options into sections. Options are displayed in a modal when the user taps the open list button. By default, do not include headers, footers, or option descriptions; include them only when strictly necessary to disambiguate or add critical context that cannot fit in the body or option titles.'
  )

export const interactiveButtonMessageSchema = z
  .object({
    type: z.literal('interactive_button'),
    header: z
      .string()
      .describe(
        'Default: omit. Only include if essential to disambiguate or add critical context. Max 60 characters. Exceeding this limit will be truncated.'
      )
      .optional(),
    body: z.string().describe('Max 1024 characters. Exceeding this limit will be truncated.'),
    footer: z
      .string()
      .describe(
        'Default: omit. Only include if essential to disambiguate or add critical context. Max 60 characters. Exceeding this limit will be truncated.'
      )
      .optional(),
    buttons: z
      .array(
        z
          .string()
          .describe('Button text. Max 20 characters. Exceeding this limit will be truncated.')
      )
      .describe('Array of buttons. Max 3 buttons. Exceeding this limit will be truncated.'),
  })
  .describe(
    'Interactive button message with up to 3 buttons displayed below the message body. Use this when you have 3 or fewer options that should be displayed directly without opening a modal. By default, do not include a header or footer; include them only when strictly necessary to disambiguate or add critical context that cannot fit in the body.'
  )

export const interactiveCtaUrlMessageSchema = z
  .object({
    type: z.literal('interactive_cta_url'),
    header: z
      .string()
      .describe('Max 60 characters. Exceeding this limit will be truncated.')
      .optional(),
    body: z.string().describe('Max 1024 characters. Exceeding this limit will be truncated.'),
    footer: z
      .string()
      .describe('Max 60 characters. Exceeding this limit will be truncated.')
      .optional(),
    action: z.object({
      text: z
        .string()
        .describe(
          'Display text for the CTA button. Max 20 characters. Exceeding this limit will be truncated.'
        ),
      url: z.string().describe('URL to open when the button is tapped.'),
    }),
  })
  .describe(
    'Interactive CTA URL message with a single button that opens a URL. Use this only when directing the user to an external link is essential. If the link is optional or informational, prefer a text message with the URL inline.'
  )

export const templateParametersSchema = z.union([
  z.array(z.string()),
  z.record(z.string(), z.string()),
])

export const templateMessageSchema = z.object({
  type: z.literal('template'),
  name: z.string(),
  language: z.string(),
  headerParameters: templateParametersSchema.optional(),
  bodyParameters: templateParametersSchema.optional(),
  footerParameters: templateParametersSchema.optional(),
  flowToken: z.string().optional(),
})

export const unsupportedMessageSchema = z.object({
  type: z.literal('unsupported'),
  unsupportedType: z.string().optional(),
})
