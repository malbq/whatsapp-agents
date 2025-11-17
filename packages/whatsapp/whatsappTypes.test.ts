import { describe, expect, test } from 'bun:test'
import { WhatsAppApi } from './whatsappTypes'

const samples = [
  {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '100000000000002',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550001234',
                phone_number_id: '100000000000001',
              },
              contacts: [
                {
                  profile: {
                    name: 'Test User',
                  },
                  wa_id: '555512340000',
                },
              ],
              messages: [
                {
                  from: '555512340000',
                  id: 'wamid.HBgMNTU1NTEyMzQwMDAwFQIAEhgWM0VCMENBNzc4QTU4NTU4NzlBQzhBRgA=',
                  timestamp: '1762821826',
                  type: 'reaction',
                  reaction: {
                    message_id: 'wamid.HBgMNTU1NTEyMzQwMDAwFQIAERgSQTU1QzQ4NDM1RDg2QjMzNkE4AA==',
                    emoji: '👍',
                  },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  },
  {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '100000000000002',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550001234',
                phone_number_id: '100000000000001',
              },
              contacts: [
                {
                  profile: {
                    name: 'Test User',
                  },
                  wa_id: '555512340000',
                },
              ],
              messages: [
                {
                  from: '555512340000',
                  id: 'wamid.HBgMNTU1NTEyMzQwMDAwFQIAEhgWM0VCMEVGNUQ4OEVBNUNGRjUwOTkwNgA=',
                  timestamp: '1762821946',
                  text: {
                    body: 'olá',
                  },
                  type: 'text',
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  },
  {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '100000000000002',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550001234',
                phone_number_id: '100000000000001',
              },
              contacts: [
                {
                  profile: {
                    name: 'Test User',
                  },
                  wa_id: '555512340000',
                },
              ],
              messages: [
                {
                  from: '555512340000',
                  id: 'wamid.HBgMNTU1NTEyMzQwMDAwFQIAEhggQUNDQTJENjNBRTQyOTBBN0EyNEQ3NDA2QTQ5N0M1MzkA',
                  timestamp: '1762822018',
                  type: 'image',
                  image: {
                    mime_type: 'image/jpeg',
                    sha256: 'Fr6Se45q7h9EnQCUMTqxaVCYTjFvw2vGQZcbNS7CWoU=',
                    id: '1180027037394069',
                  },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  },
  {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '100000000000002',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550001234',
                phone_number_id: '100000000000001',
              },
              contacts: [
                {
                  profile: {
                    name: 'Test User',
                  },
                  wa_id: '555512340000',
                },
              ],
              messages: [
                {
                  from: '555512340000',
                  id: 'wamid.HBgMNTU1NTEyMzQwMDAwFQIAEhggQUM2RDE3NThFMzI2QzgyNzZBQUY0RkNEQTZGODU2QkEA',
                  timestamp: '1762822034',
                  type: 'contacts',
                  contacts: [
                    {
                      name: {
                        first_name: 'Test',
                        last_name: 'User',
                        formatted_name: 'Test User',
                      },
                      phones: [
                        {
                          phone: '+55 55 1234-0000',
                          wa_id: '555512340000',
                          type: 'Celular',
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  },
  {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '100000000000002',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550001234',
                phone_number_id: '100000000000001',
              },
              contacts: [
                {
                  profile: {
                    name: 'Test User',
                  },
                  wa_id: '555512340000',
                },
              ],
              messages: [
                {
                  from: '555512340000',
                  id: 'wamid.HBgMNTU1NTEyMzQwMDAwFQIAEhggQUNDMDUxRDRCMkRCMjNGNEU4Mjk3NUFBMzRENDdENjUA',
                  timestamp: '1762822049',
                  location: {
                    latitude: -3.7398751,
                    longitude: -38.4916444,
                  },
                  type: 'location',
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  },
  {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '100000000000002',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550001234',
                phone_number_id: '100000000000001',
              },
              contacts: [
                {
                  profile: {
                    name: 'Test User',
                  },
                  wa_id: '555512340000',
                },
              ],
              messages: [
                {
                  from: '555512340000',
                  id: 'wamid.HBgMNTU1NTEyMzQwMDAwFQIAEhggQUM2ODY4NkVBMTk4MDJDQ0I2RkVDRDA3RDNBQkI2MDcA',
                  timestamp: '1762822089',
                  type: 'document',
                  document: {
                    filename: 'MAURO GADELHA VENC 06-09-25.pdf',
                    mime_type: 'application/pdf',
                    sha256: 'I8/xLC83sotRPqMVmClhxFWZ8sGke5N4CX2nDSFEumM=',
                    id: '2080309022740413',
                  },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  },
  {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '100000000000002',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550001234',
                phone_number_id: '100000000000001',
              },
              contacts: [
                {
                  profile: {
                    name: 'Test User',
                  },
                  wa_id: '555512340000',
                },
              ],
              messages: [
                {
                  from: '555512340000',
                  id: 'wamid.HBgMNTU1NTEyMzQwMDAwFQIAEhggQUM2ODY4NkVBMTk4MDJDQ0I2RkVDRDA3RDNBQkI2MDcA',
                  timestamp: '1762822089',
                  type: 'document',
                  document: {
                    filename: 'MAURO GADELHA VENC 06-09-25.pdf',
                    mime_type: 'application/pdf',
                    sha256: 'I8/xLC83sotRPqMVmClhxFWZ8sGke5N4CX2nDSFEumM=',
                    id: '2080309022740413',
                  },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  },
  {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '100000000000002',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550001234',
                phone_number_id: '100000000000001',
              },
              contacts: [
                {
                  profile: {
                    name: 'Test User',
                  },
                  wa_id: '555512340000',
                },
              ],
              messages: [
                {
                  from: '555512340000',
                  id: 'wamid.HBgMNTU1NTEyMzQwMDAwFQIAEhggQUM1MjVFRUNCMjQ3OEJEOUZGNjgzRUE2RjI4QjczQjIA',
                  timestamp: '1762822102',
                  type: 'audio',
                  audio: {
                    mime_type: 'audio/ogg; codecs=opus',
                    sha256: 'rgWqsIaaN95Pqi1czzVFBYNOZZGPVZaQ8vvira3udRQ=',
                    id: '24983491987946357',
                    voice: false,
                  },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  },
  {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '100000000000002',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550001234',
                phone_number_id: '100000000000001',
              },
              contacts: [
                {
                  profile: {
                    name: 'Test User',
                  },
                  wa_id: '555512340000',
                },
              ],
              messages: [
                {
                  from: '555512340000',
                  id: 'wamid.HBgMNTU1NTEyMzQwMDAwFQIAEhggQUNEM0I1RTQwRDIxMjRENjZDNzQ1M0E4N0UzOEZEMjgA',
                  timestamp: '1762822115',
                  type: 'audio',
                  audio: {
                    mime_type: 'audio/ogg; codecs=opus',
                    sha256: 'FS33uM58D4w6dUb7extlupN9sPnhwIFOg091mfpcvvg=',
                    id: '827927779841002',
                    voice: true,
                  },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  },
  {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '100000000000002',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550001234',
                phone_number_id: '100000000000001',
              },
              contacts: [
                {
                  profile: {
                    name: 'Test User',
                  },
                  wa_id: '555512340000',
                },
              ],
              messages: [
                {
                  from: '555512340000',
                  id: 'wamid.HBgMNTU1NTEyMzQwMDAwFQIAEhggQUM4MjZEM0ExOTRDMUM4N0E5MzM1RkVEM0U5NDg1OTAA',
                  timestamp: '1762822137',
                  type: 'sticker',
                  sticker: {
                    mime_type: 'image/webp',
                    sha256: 'ZUxsrwUSoNT5HmDaps3/5Yl4lApVlXj/1hL78Fr1eh0=',
                    id: '1087331349982015',
                    animated: false,
                  },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  },
]

describe('WhatsAppApi.NotificationSchema', () => {
  test.each(samples.map((s) => [s]))('validates notification sample', (sample) => {
    const result = WhatsAppApi.notificationSchema.safeParse(sample)
    expect(result.success).toBe(true)
    if (!result.success) {
      console.error('Failed sample:', sample)
      console.error('Errors:', result.error.issues)
    }
  })

  test('rejects invalid object type', () => {
    const invalid = {
      object: 'invalid',
      entry: [],
    }
    const result = WhatsAppApi.notificationSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  test('rejects missing entry', () => {
    const invalid = {
      object: 'whatsapp_business_account',
    }
    const result = WhatsAppApi.notificationSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})
