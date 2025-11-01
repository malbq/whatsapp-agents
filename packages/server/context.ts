import { getContext as getContextHono } from 'hono/context-storage'

export type Env = {
  Variables: {
    businessPhoneNumberId?: string
    userWhatsappId?: string
  }
}

export const getContext = () => getContextHono<Env>()
