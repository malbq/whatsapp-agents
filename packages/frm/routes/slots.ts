import type { Context } from 'hono'
import type { FrmDB } from '../db'

export function createSlotRoutes(frmDB: FrmDB) {
  return {
    async create(c: Context) {
      try {
        const body = await c.req.json()

        if (!body.date || !body.time) {
          return c.json({ error: 'Date and time are required' }, 400)
        }

        const existingSlot = await frmDB.findSlotByDateTime(body.date, body.time)
        if (existingSlot) {
          return c.json({ error: 'A slot with this date and time already exists' }, 400)
        }

        const slot = await frmDB.createSlot({
          date: body.date,
          time: body.time,
          available: true,
        })

        return c.json({ success: true, slot }, 201)
      } catch (error) {
        console.error('Error creating slot:', error)
        return c.json({ error: 'Failed to create slot' }, 500)
      }
    },
  }
}
