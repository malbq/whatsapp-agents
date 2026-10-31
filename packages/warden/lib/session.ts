export interface Session {
  email: string
  expiresAt: number
}

export interface Sessions {
  sign: (session: Session) => Promise<string>
  getSession: (cookie: string | undefined) => Promise<Session | null>
}

export const SESSION_COOKIE = 'warden_session'

const encoder = new TextEncoder()

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  const pairs = hex.match(/.{2}/g)
  if (!pairs) return null
  return new Uint8Array(pairs.map((byte) => parseInt(byte, 16)))
}

/** HMAC-signed session tokens: `base64url(payload).hex(signature)` */
export function createSessions(secret: string): Sessions {
  const keyPromise = crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )

  async function sign(session: Session): Promise<string> {
    const payload = JSON.stringify(session)
    const signature = await crypto.subtle.sign('HMAC', await keyPromise, encoder.encode(payload))
    return `${Buffer.from(payload).toString('base64url')}.${toHex(signature)}`
  }

  async function verify(token: string): Promise<Session | null> {
    const parts = token.split('.')
    if (parts.length !== 2) return null

    const [payloadB64, signatureHex] = parts
    if (!payloadB64 || !signatureHex) return null

    const signature = fromHex(signatureHex)
    if (!signature) return null

    const payload = Buffer.from(payloadB64, 'base64url').toString('utf-8')
    const valid = await crypto.subtle.verify(
      'HMAC',
      await keyPromise,
      signature,
      encoder.encode(payload)
    )
    if (!valid) return null

    const data = JSON.parse(payload) as Session
    if (data.expiresAt < Date.now()) return null

    return data
  }

  return {
    sign,
    getSession: async (cookie) => (cookie ? verify(cookie) : null),
  }
}
