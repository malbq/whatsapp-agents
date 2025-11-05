import type { DB } from '@batman/core/infra/db'
import type { Context } from 'hono'
import { dataStore, saveData } from '../lib/dataStore'
import type { Candidate } from '../types'

export function createCandidateRoutes(db: DB) {
  return {
    // Create new candidate
    async create(c: Context) {
      try {
        const body = await c.req.json()
        
        if (!body.name || !body.phone || !body.position) {
          return c.json({ error: 'Name, phone, and position are required' }, 400)
        }

        const candidate: Candidate = {
          id: Bun.randomUUIDv7(),
          name: body.name,
          phone: body.phone,
          position: body.position,
          currentFlow: undefined,
        }

        dataStore.candidates.set(candidate.id, candidate)
        await saveData()

        return c.json({ success: true, candidate }, 201)
      } catch (error) {
        console.error('Error creating candidate:', error)
        return c.json({ error: 'Failed to create candidate' }, 500)
      }
    },

    // Update existing candidate
    async update(c: Context) {
      try {
        const id = c.req.param('id')
        const body = await c.req.json()

        const candidate = dataStore.candidates.get(id)
        if (!candidate) {
          return c.json({ error: 'Candidate not found' }, 404)
        }

        if (body.name !== undefined) candidate.name = body.name
        if (body.phone !== undefined) candidate.phone = body.phone
        if (body.position !== undefined) candidate.position = body.position
        if (body.currentFlow !== undefined) candidate.currentFlow = body.currentFlow

        dataStore.candidates.set(id, candidate)
        await saveData()

        return c.json({ success: true, candidate })
      } catch (error) {
        console.error('Error updating candidate:', error)
        return c.json({ error: 'Failed to update candidate' }, 500)
      }
    },

    // Delete candidate
    async delete(c: Context) {
      try {
        const id = c.req.param('id')

        if (!dataStore.candidates.has(id)) {
          return c.json({ error: 'Candidate not found' }, 404)
        }

        dataStore.candidates.delete(id)
        await saveData()

        return c.json({ success: true, message: 'Candidate deleted' })
      } catch (error) {
        console.error('Error deleting candidate:', error)
        return c.json({ error: 'Failed to delete candidate' }, 500)
      }
    },

    // Get single candidate
    async get(c: Context) {
      try {
        const id = c.req.param('id')
        const candidate = dataStore.candidates.get(id)

        if (!candidate) {
          return c.json({ error: 'Candidate not found' }, 404)
        }

        return c.json({ success: true, candidate })
      } catch (error) {
        console.error('Error fetching candidate:', error)
        return c.json({ error: 'Failed to fetch candidate' }, 500)
      }
    },

    // List all candidates
    async list(c: Context) {
      try {
        const candidates = Array.from(dataStore.candidates.values())
        return c.json({ success: true, candidates })
      } catch (error) {
        console.error('Error listing candidates:', error)
        return c.json({ error: 'Failed to list candidates' }, 500)
      }
    },
  }
}
