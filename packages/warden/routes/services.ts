import { Hono } from 'hono'
import { z } from 'zod'
import type { WardenDB } from '../db'
import type { AuthMiddleware } from '../lib/authMiddleware'

const createServiceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  durationMinutes: z
    .number()
    .int()
    .min(5, 'Duration must be at least 5 minutes')
    .max(480, 'Duration cannot exceed 8 hours'),
})

const updateServiceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  durationMinutes: z
    .number()
    .int()
    .min(5, 'Duration must be at least 5 minutes')
    .max(480, 'Duration cannot exceed 8 hours')
    .optional(),
})

export function createServicesRoute(db: WardenDB, auth: AuthMiddleware) {
  const app = new Hono()

  app.use('*', auth.requireAuthApi)

  // List all services (excludes soft-deleted)
  app.get('/', async (c) => {
    const services = await db.listServices()
    return c.json({ services })
  })

  // Get a single service by ID
  app.get('/:id', async (c) => {
    const id = c.req.param('id')
    const service = await db.getService(id)

    if (!service || service.deletedAt) {
      return c.json({ error: 'Service not found' }, 404)
    }

    return c.json({ service })
  })

  // Create a new service
  app.post('/', async (c) => {
    const body = await c.req.json()

    const validation = createServiceSchema.safeParse(body)
    if (!validation.success) {
      return c.json({ error: validation.error.issues[0]?.message }, 400)
    }

    const service = await db.createService({
      name: validation.data.name,
      description: validation.data.description,
      durationMinutes: validation.data.durationMinutes,
    })

    return c.json({ service }, 201)
  })

  // Update an existing service
  app.patch('/:id', async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json()

    const validation = updateServiceSchema.safeParse(body)
    if (!validation.success) {
      return c.json({ error: validation.error.issues[0]?.message }, 400)
    }

    // Check if service exists and is not deleted
    const existing = await db.getService(id)
    if (!existing || existing.deletedAt) {
      return c.json({ error: 'Service not found' }, 404)
    }

    const updateData: Parameters<typeof db.updateService>[1] = {}
    if (validation.data.name !== undefined) updateData.name = validation.data.name
    if (validation.data.description !== undefined)
      updateData.description = validation.data.description ?? undefined
    if (validation.data.durationMinutes !== undefined)
      updateData.durationMinutes = validation.data.durationMinutes

    const service = await db.updateService(id, updateData)

    return c.json({ service })
  })

  // Soft delete a service
  app.delete('/:id', async (c) => {
    const id = c.req.param('id')

    // Check if service exists and is not already deleted
    const existing = await db.getService(id)
    if (!existing || existing.deletedAt) {
      return c.json({ error: 'Service not found' }, 404)
    }

    await db.deleteService(id)

    return c.json({ success: true })
  })

  return app
}
