import { describe, expect, test } from 'bun:test'
import {
  audioMessageSchema,
  contactMessageSchema,
  incomingDocumentMessageSchema,
  incomingImageMessageSchema,
  interactiveButtonMessageSchema,
  interactiveCtaUrlMessageSchema,
  interactiveListMessageSchema,
  locationMessageSchema,
  reactionMessageSchema,
  templateMessageSchema,
  templateParametersSchema,
  textMessageSchema,
  unsupportedMessageSchema,
  voiceMessageSchema,
} from './schema'

describe('textMessageSchema', () => {
  test('validates valid text message', () => {
    const data = { type: 'text', text: 'Hello world' }
    const result = textMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('accepts empty string', () => {
    const data = { type: 'text', text: '' }
    const result = textMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('rejects missing text field', () => {
    const data = { type: 'text' }
    const result = textMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test('rejects wrong type literal', () => {
    const data = { type: 'invalid', text: 'Hello' }
    const result = textMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('voiceMessageSchema', () => {
  test('validates valid voice message', () => {
    const data = {
      type: 'voice',
      data: new ArrayBuffer(10),
      mimeType: 'audio/ogg',
    }
    const result = voiceMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('rejects missing data field', () => {
    const data = { type: 'voice', mimeType: 'audio/ogg' }
    const result = voiceMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test('rejects non-ArrayBuffer data', () => {
    const data = { type: 'voice', data: 'not-arraybuffer', mimeType: 'audio/ogg' }
    const result = voiceMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('audioMessageSchema', () => {
  test('validates valid audio message', () => {
    const data = {
      type: 'audio',
      data: new ArrayBuffer(10),
      mimeType: 'audio/mpeg',
    }
    const result = audioMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('rejects missing mimeType', () => {
    const data = { type: 'audio', data: new ArrayBuffer(10) }
    const result = audioMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('documentMessageSchema', () => {
  test('validates valid document message', () => {
    const data = {
      type: 'document',
      data: new ArrayBuffer(10),
      mimeType: 'application/pdf',
      filename: 'document.pdf',
    }
    const result = incomingDocumentMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('validates document with caption', () => {
    const data = {
      type: 'document',
      data: new ArrayBuffer(10),
      mimeType: 'application/pdf',
      filename: 'document.pdf',
      caption: 'Check this out',
    }
    const result = incomingDocumentMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('rejects missing filename', () => {
    const data = {
      type: 'document',
      data: new ArrayBuffer(10),
      mimeType: 'application/pdf',
    }
    const result = incomingDocumentMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('imageMessageSchema', () => {
  test('validates valid image message', () => {
    const data = {
      type: 'image',
      data: new ArrayBuffer(10),
      mimeType: 'image/jpeg',
    }
    const result = incomingImageMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('validates image with caption', () => {
    const data = {
      type: 'image',
      data: new ArrayBuffer(10),
      mimeType: 'image/jpeg',
      caption: 'Beautiful sunset',
    }
    const result = incomingImageMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('rejects missing data field', () => {
    const data = { type: 'image', mimeType: 'image/jpeg' }
    const result = incomingImageMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('locationMessageSchema', () => {
  test('validates valid location message', () => {
    const data = {
      type: 'location',
      latitude: 40.7128,
      longitude: -74.006,
      name: 'New York',
      address: '123 Main St',
    }
    const result = locationMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('validates location without optional fields', () => {
    const data = {
      type: 'location',
      latitude: 40.7128,
      longitude: -74.006,
    }
    const result = locationMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('rejects missing latitude', () => {
    const data = { type: 'location', longitude: -74.006 }
    const result = locationMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test('rejects invalid latitude type', () => {
    const data = { type: 'location', latitude: 'invalid', longitude: -74.006 }
    const result = locationMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('contactMessageSchema', () => {
  test('validates valid contact message', () => {
    const data = {
      type: 'contact',
      name: 'John Doe',
      phone: '+1234567890',
    }
    const result = contactMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('rejects missing name', () => {
    const data = { type: 'contact', phone: '+1234567890' }
    const result = contactMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test('rejects missing phone', () => {
    const data = { type: 'contact', name: 'John Doe' }
    const result = contactMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('reactionMessageSchema', () => {
  test('validates valid reaction message', () => {
    const data = {
      type: 'reaction',
      emoji: '👍',
      targetMessageId: 'msg-123',
    }
    const result = reactionMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('rejects missing emoji', () => {
    const data = { type: 'reaction', targetMessageId: 'msg-123' }
    const result = reactionMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test('rejects missing targetMessageId', () => {
    const data = { type: 'reaction', emoji: '👍' }
    const result = reactionMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('interactiveListMessageSchema', () => {
  test('validates valid interactive list message', () => {
    const data = {
      type: 'interactive_list',
      body: 'Choose an option',
      openListButton: 'Select',
      sections: [
        {
          title: 'Section 1',
          options: [{ title: 'Option 1', description: 'First option' }, { title: 'Option 2' }],
        },
      ],
    }
    const result = interactiveListMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('validates without optional fields', () => {
    const data = {
      type: 'interactive_list',
      body: 'Choose',
      openListButton: 'Open',
      sections: [{ options: [{ title: 'Option 1' }] }],
    }
    const result = interactiveListMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('rejects missing body', () => {
    const data = {
      type: 'interactive_list',
      openListButton: 'Select',
      sections: [],
    }
    const result = interactiveListMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test('rejects missing openListButton', () => {
    const data = {
      type: 'interactive_list',
      body: 'Choose',
      sections: [],
    }
    const result = interactiveListMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test('rejects missing sections', () => {
    const data = {
      type: 'interactive_list',
      body: 'Choose',
      openListButton: 'Select',
    }
    const result = interactiveListMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test('rejects section without options', () => {
    const data = {
      type: 'interactive_list',
      body: 'Choose',
      openListButton: 'Select',
      sections: [{ title: 'Section 1' }],
    }
    const result = interactiveListMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test('rejects option without title', () => {
    const data = {
      type: 'interactive_list',
      body: 'Choose',
      openListButton: 'Select',
      sections: [{ options: [{ description: 'No title' }] }],
    }
    const result = interactiveListMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('interactiveButtonMessageSchema', () => {
  test('validates valid interactive button message', () => {
    const data = {
      type: 'interactive_button',
      body: 'Choose an option',
      buttons: ['Option 1', 'Option 2', 'Option 3'],
    }
    const result = interactiveButtonMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('validates with optional header and footer', () => {
    const data = {
      type: 'interactive_button',
      header: 'Header',
      body: 'Body',
      footer: 'Footer',
      buttons: ['Button 1'],
    }
    const result = interactiveButtonMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('rejects missing body', () => {
    const data = {
      type: 'interactive_button',
      buttons: ['Option 1'],
    }
    const result = interactiveButtonMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test('rejects missing buttons', () => {
    const data = {
      type: 'interactive_button',
      body: 'Choose',
    }
    const result = interactiveButtonMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test('accepts empty buttons array', () => {
    const data = {
      type: 'interactive_button',
      body: 'No buttons',
      buttons: [],
    }
    const result = interactiveButtonMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe('interactiveCtaUrlMessageSchema', () => {
  test('validates valid interactive CTA URL message', () => {
    const data = {
      type: 'interactive_cta_url',
      body: 'Click here',
      action: {
        text: 'Open',
        url: 'https://example.com',
      },
    }
    const result = interactiveCtaUrlMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('validates with optional header and footer', () => {
    const data = {
      type: 'interactive_cta_url',
      header: 'Header',
      body: 'Body',
      footer: 'Footer',
      action: {
        text: 'Click',
        url: 'https://example.com',
      },
    }
    const result = interactiveCtaUrlMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('rejects missing body', () => {
    const data = {
      type: 'interactive_cta_url',
      action: {
        text: 'Click',
        url: 'https://example.com',
      },
    }
    const result = interactiveCtaUrlMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test('rejects missing action', () => {
    const data = {
      type: 'interactive_cta_url',
      body: 'Click here',
    }
    const result = interactiveCtaUrlMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test('rejects action without text', () => {
    const data = {
      type: 'interactive_cta_url',
      body: 'Click here',
      action: {
        url: 'https://example.com',
      },
    }
    const result = interactiveCtaUrlMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test('rejects action without url', () => {
    const data = {
      type: 'interactive_cta_url',
      body: 'Click here',
      action: {
        text: 'Click',
      },
    }
    const result = interactiveCtaUrlMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('templateParametersSchema', () => {
  test('validates array of strings', () => {
    const data = ['param1', 'param2', 'param3']
    const result = templateParametersSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('validates record of strings', () => {
    const data = { key1: 'value1', key2: 'value2' }
    const result = templateParametersSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('rejects non-string array elements', () => {
    const data = ['param1', 123, 'param3']
    const result = templateParametersSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test('rejects record with non-string values', () => {
    const data = { key1: 'value1', key2: 123 }
    const result = templateParametersSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test('accepts empty array', () => {
    const data: string[] = []
    const result = templateParametersSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('accepts empty record', () => {
    const data: Record<string, string> = {}
    const result = templateParametersSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe('templateMessageSchema', () => {
  test('validates valid template message', () => {
    const data = {
      type: 'template',
      name: 'welcome_template',
      language: 'en',
    }
    const result = templateMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('validates with all parameters', () => {
    const data = {
      type: 'template',
      name: 'welcome_template',
      language: 'en',
      headerParameters: ['Header'],
      bodyParameters: ['Body'],
      footerParameters: ['Footer'],
    }
    const result = templateMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('validates with record parameters', () => {
    const data = {
      type: 'template',
      name: 'welcome_template',
      language: 'en',
      bodyParameters: { name: 'John', age: '30' },
    }
    const result = templateMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('rejects missing name', () => {
    const data = {
      type: 'template',
      language: 'en',
      bodyParameters: [],
    }
    const result = templateMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  test('rejects missing language', () => {
    const data = {
      type: 'template',
      name: 'welcome_template',
      bodyParameters: [],
    }
    const result = templateMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('unsupportedMessageSchema', () => {
  test('validates valid unsupported message', () => {
    const data = {
      type: 'unsupported',
      unsupportedType: 'sticker',
    }
    const result = unsupportedMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('validates without unsupportedType', () => {
    const data = {
      type: 'unsupported',
    }
    const result = unsupportedMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  test('rejects wrong type literal', () => {
    const data = {
      type: 'text',
      unsupportedType: 'sticker',
    }
    const result = unsupportedMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})
